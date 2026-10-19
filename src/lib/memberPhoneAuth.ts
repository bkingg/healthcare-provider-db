import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hash, newToken, startMemberSession } from "@/lib/memberAuth";
import { sendWhatsAppCode, showDevCodes } from "@/lib/whatsapp";
import {
  CODE_LENGTH,
  CODE_MINUTES,
  CONSENT_VERSION,
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_IP_PER_HOUR,
  MAX_CODES_PER_PHONE_PER_HOUR,
  TICKET_MINUTES,
  isAdult,
  normalizeSignInPhone,
  type SignInPhone,
} from "@/lib/phoneSignIn";

/** Member sign-in by phone: a code sent on WhatsApp, then either the
 * member's profile (one, or a choice when a household shares the number)
 * or — for a number Nomad doesn't know — a quick-start account, not
 * covered. Codes and tickets are stored only as hashes. */

const TICKET_COOKIE = "nomad_phone_ticket";

/** Message codes the sign-in screen translates. */
export class PhoneSignInError extends Error {}

export type PhoneProfile = { id: string; firstName: string; lastName: string; relationshipEn: string | null; relationshipFr: string | null; isPrimary: boolean };

async function requesterIpHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  return hash(`ip:${ip}`);
}

const codeHash = (phone: string, code: string) => hash(`${phone}:${code}`);

/** Sends a code to the number — whether or not it belongs to a member, so
 * the screen can't be used to find out who is one (and so newcomers can
 * start). `devCode` is only set while no WhatsApp account is connected,
 * outside production. */
export async function requestPhoneCode(raw: string, country: string, language: "fr" | "en"): Promise<{ phone: SignInPhone; devCode?: string }> {
  const phone = normalizeSignInPhone(raw, country);
  if (!phone) throw new PhoneSignInError("invalidPhone");
  const ipHash = await requesterIpHash();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [byPhone, byIp] = await Promise.all([
    prisma.memberPhoneCode.count({ where: { phone: phone.e164, createdAt: { gt: hourAgo } } }),
    prisma.memberPhoneCode.count({ where: { ipHash, createdAt: { gt: hourAgo } } }),
  ]);
  if (byPhone >= MAX_CODES_PER_PHONE_PER_HOUR || byIp >= MAX_CODES_PER_IP_PER_HOUR) throw new PhoneSignInError("tooManyCodes");

  const code = String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  await prisma.memberPhoneCode.create({
    data: { phone: phone.e164, codeHash: codeHash(phone.e164, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000), ipHash },
  });
  try {
    await sendWhatsAppCode(phone.e164, code, language);
  } catch (err) {
    console.error("[whatsapp] sign-in code not sent:", err);
    throw new PhoneSignInError("sendFailed");
  }
  return { phone, devCode: showDevCodes() ? code : undefined };
}

/** Active, adult members whose record has this number, however it was
 * typed ("77 123 45 67", "+221 77…"). */
async function profilesFor(phone: SignInPhone): Promise<PhoneProfile[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM member
    WHERE status = 'ACTIVE' AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ANY(${phone.digitForms})`;
  if (!rows.length) return [];
  const members = await prisma.member.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: { relationship: true },
    orderBy: [{ primaryMemberId: { sort: "asc", nulls: "first" } }, { firstName: "asc" }],
  });
  return members
    .filter((m) => isAdult(m.dateOfBirth))
    .map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, relationshipEn: m.relationship?.nameEn ?? null, relationshipFr: m.relationship?.nameFr ?? null, isPrimary: !m.primaryMemberId }));
}

/** Checks the code for the latest one sent to this number. Right: a ticket
 * cookie for the next step, and who the number belongs to. Wrong: one try
 * used (five per code). */
export async function verifyPhoneCode(e164: string, code: string): Promise<{ phone: SignInPhone; profiles: PhoneProfile[] }> {
  const phone = normalizeSignInPhone(e164, "SN");
  if (!phone) throw new PhoneSignInError("invalidPhone");
  const sent = await prisma.memberPhoneCode.findFirst({ where: { phone: phone.e164, verifiedAt: null }, orderBy: { createdAt: "desc" } });
  if (!sent || sent.expiresAt < new Date()) throw new PhoneSignInError("codeExpired");
  if (sent.attempts >= MAX_CODE_ATTEMPTS) throw new PhoneSignInError("tooManyAttempts");

  const given = Buffer.from(codeHash(phone.e164, code.replace(/\D/g, "")));
  const expected = Buffer.from(sent.codeHash);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    const { attempts } = await prisma.memberPhoneCode.update({ where: { id: sent.id }, data: { attempts: { increment: 1 } } });
    throw new PhoneSignInError(attempts >= MAX_CODE_ATTEMPTS ? "tooManyAttempts" : "wrongCode");
  }

  const ticket = newToken();
  const ticketExpiresAt = new Date(Date.now() + TICKET_MINUTES * 60 * 1000);
  // Conditional, so the same code can't be redeemed twice at once.
  const won = await prisma.memberPhoneCode.updateMany({
    where: { id: sent.id, verifiedAt: null },
    data: { verifiedAt: new Date(), ticketHash: hash(ticket), ticketExpiresAt },
  });
  if (won.count !== 1) throw new PhoneSignInError("codeExpired");
  (await cookies()).set(TICKET_COOKIE, ticket, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: ticketExpiresAt });
  return { phone, profiles: await profilesFor(phone) };
}

/** The verified number behind this device's ticket, if it's still good. */
async function currentTicket() {
  const ticket = (await cookies()).get(TICKET_COOKIE)?.value;
  if (!ticket) throw new PhoneSignInError("startAgain");
  const row = await prisma.memberPhoneCode.findUnique({ where: { ticketHash: hash(ticket) } });
  if (!row || row.consumedAt || !row.ticketExpiresAt || row.ticketExpiresAt < new Date()) throw new PhoneSignInError("startAgain");
  const phone = normalizeSignInPhone(row.phone, "SN");
  if (!phone) throw new PhoneSignInError("startAgain");
  return { row, phone };
}

async function consume(rowId: string) {
  const used = await prisma.memberPhoneCode.updateMany({ where: { id: rowId, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count !== 1) throw new PhoneSignInError("startAgain");
  (await cookies()).delete(TICKET_COOKIE);
}

/** Signs in as one of the profiles on the verified number. */
export async function signInWithPhone(memberId: string): Promise<{ language: string }> {
  const { row, phone } = await currentTicket();
  const profile = (await profilesFor(phone)).find((p) => p.id === memberId);
  if (!profile) throw new PhoneSignInError("startAgain");
  await consume(row.id);
  await startMemberSession(memberId);
  const m = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { preferredLanguage: true } });
  return { language: m.preferredLanguage };
}

/** Quick start: a new member on the verified number, not covered — every
 * request is a special request, priced before anything is done. */
export async function quickStartMember(input: { firstName: string; lastName: string; language: "fr" | "en" }): Promise<void> {
  const { row, phone } = await currentTicket();
  const country = await prisma.countryRef.findFirst({ where: { iso2: phone.country }, select: { id: true } });
  const member = await prisma.$transaction(async (tx) => {
    const used = await tx.memberPhoneCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (used.count !== 1) throw new PhoneSignInError("startAgain");
    return tx.member.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: phone.international,
        countryId: country?.id ?? null,
        preferredLanguage: input.language,
        isCovered: false,
        signupSource: "SELF",
        consentAt: new Date(),
        consentVersion: CONSENT_VERSION,
      },
    });
  });
  (await cookies()).delete(TICKET_COOKIE);
  await startMemberSession(member.id);
}
