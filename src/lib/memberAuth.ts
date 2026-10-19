import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { sendEmail, showDevEmailLinks } from "@/lib/email";

/** Member sign-in (MVP step 1.2): one-time links by email — or a code by
 * WhatsApp, see memberPhoneAuth.ts — then a session cookie. Entirely separate from staff auth (src/lib/auth.ts): a member
 * session can't reach staff pages — proxy.ts sends every non-member route
 * through the staff login — and staff sessions don't reach member data. */

export const MEMBER_COOKIE = "nomad_member_session";
const LINK_MINUTES = 15;
const SESSION_DAYS = 30;
const MAX_LINKS_PER_HOUR = 5;

export function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Sends a sign-in link if `email` belongs to an active member. Always
 * resolves the same way to the caller whether or not it does, so the form
 * can't be used to find out who is a member. `devLink` is only set when no
 * email service is configured and this isn't a production build. */
export async function requestLoginLink(email: string, locale: string): Promise<{ devLink?: string }> {
  const member = await prisma.member.findFirst({ where: { email: email.trim().toLowerCase(), status: "ACTIVE" } });
  if (!member?.email) return {};

  const recent = await prisma.memberLoginToken.count({
    where: { memberId: member.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_LINKS_PER_HOUR) return {};

  const token = newToken();
  await prisma.memberLoginToken.create({
    data: { memberId: member.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000) },
  });
  const lang = member.preferredLanguage === "en" ? "en" : locale === "en" ? "en" : "fr";
  const link = `${await appOrigin()}/${lang}/m/auth?token=${token}`;
  const fr = lang === "fr";
  await sendEmail({
    to: member.email,
    subject: fr ? "Votre lien de connexion Nomad" : "Your Nomad sign-in link",
    text: fr
      ? `Bonjour ${member.firstName},\n\nOuvrez ce lien pour vous connecter à Nomad (valable ${LINK_MINUTES} minutes, une seule fois) :\n${link}\n\nSi vous n'avez rien demandé, ignorez cet e-mail.`
      : `Hello ${member.firstName},\n\nOpen this link to sign in to Nomad (valid for ${LINK_MINUTES} minutes, once):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  });
  return showDevEmailLinks() ? { devLink: link } : {};
}

/** Turns a valid, unused, unexpired link into a session cookie. Marking the
 * token used and checking it happen in one conditional update, so the same
 * link can't be redeemed twice even if opened twice at once. Returns the
 * member's preferred language, or null if the link can't be used. */
export async function redeemLoginLink(token: string): Promise<{ language: string } | null> {
  const tokenHash = hash(token);
  const used = await prisma.memberLoginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, member: { status: "ACTIVE" } },
    data: { usedAt: new Date() },
  });
  if (used.count !== 1) return null;
  const { member } = await prisma.memberLoginToken.findUniqueOrThrow({ where: { tokenHash }, include: { member: true } });
  await startMemberSession(member.id);
  return { language: member.preferredLanguage };
}

/** Signs the member in on this device: a new session and its cookie. Used
 * by email links and phone codes alike. */
export async function startMemberSession(memberId: string): Promise<void> {
  const sessionToken = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.memberSession.create({ data: { memberId, tokenHash: hash(sessionToken), expiresAt } });
  (await cookies()).set(MEMBER_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in member, or null. Cached per request. An inactive member or
 * expired session counts as signed out. */
export const getCurrentMember = cache(async () => {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.memberSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { member: { include: { country: true, relationship: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.member.status !== "ACTIVE") return null;
  // Refreshed at most hourly — enough to see when a member last used the app.
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await prisma.memberSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session.member;
});

export type CurrentMember = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

export async function signOutMember(): Promise<void> {
  const store = await cookies();
  const token = store.get(MEMBER_COOKIE)?.value;
  if (token) await prisma.memberSession.deleteMany({ where: { tokenHash: hash(token) } });
  store.delete(MEMBER_COOKIE);
}
