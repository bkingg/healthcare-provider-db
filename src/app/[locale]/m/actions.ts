"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentMember, redeemLoginLink, requestLoginLink, signOutMember } from "@/lib/memberAuth";
import { memberRequestSchema } from "@/lib/validation/memberRequest";
import { createMemberCase, RequestNotAllowedError } from "@/data/memberApp";
import { normalizeCallbackPhone } from "@/lib/phone";
import { fail, type ActionResult } from "@/lib/validation/common";

export type LoginLinkState = { sent: true; devLink?: string } | { sent: false; error: string } | null;

/** Always answers "sent" for a valid email address — whether or not it
 * belongs to a member — so the form can't reveal who is a member. */
export async function requestLoginLinkAction(_prev: LoginLinkState, formData: FormData): Promise<LoginLinkState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { sent: false, error: "invalidEmail" };
  const { devLink } = await requestLoginLink(email.data, await getLocale());
  return { sent: true, devLink };
}

/** The sign-in link opens a page with a button that calls this — a plain
 * GET never signs anyone in, because email security scanners open links
 * automatically and would otherwise use up the one-time token. */
export async function redeemLoginLinkAction(_prev: { failed: boolean } | null, formData: FormData): Promise<{ failed: boolean }> {
  const token = String(formData.get("token") ?? "");
  const result = token ? await redeemLoginLink(token) : null;
  if (!result) return { failed: true };
  return redirect({ href: "/m", locale: result.language === "en" ? "en" : "fr" });
}

export async function signOutMemberAction(): Promise<void> {
  await signOutMember();
  redirect({ href: "/m/login", locale: await getLocale() });
}

export async function createRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  const locale = await getLocale();
  if (!member) return redirect({ href: "/m/login", locale });

  const parsed = memberRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  // Numbers typed without a country code are read as the member's country.
  const contactPhone = normalizeCallbackPhone(parsed.data.contactPhone, member.country?.iso2?.trim() ?? "SN");
  if (!contactPhone) return fail({ contactPhone: ["invalid"] });
  let caseId: string;
  try {
    caseId = (await createMemberCase(member, { ...parsed.data, contactPhone })).id;
  } catch (err) {
    if (err instanceof RequestNotAllowedError) return fail({ form: [err.message] });
    throw err;
  }
  return redirect({ href: `/m/requests/${caseId}?sent=1`, locale });
}
