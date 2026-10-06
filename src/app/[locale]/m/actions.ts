"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentMember, redeemLoginLink, requestLoginLink, signOutMember } from "@/lib/memberAuth";
import { memberRequestSchema } from "@/lib/validation/memberRequest";
import { createMemberCase, getMemberCase, RequestNotAllowedError } from "@/data/memberApp";
import { memberReply } from "@/data/caseOps";
import { normalizeCallbackPhone } from "@/lib/phone";
import { fail, type ActionResult } from "@/lib/validation/common";
import { medicationOrderSchema } from "@/lib/validation/medicationOrder";
import { createMemberMedicationOrder, OrderRejectedError, prepareQuotesForCase, searchCatalogForMember } from "@/data/medicationOrders";
import { approvePrice, declinePrice, OrderStepError, reportPayment } from "@/data/orderPayments";

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

/** The member answers Nomad on a request they can see. */
export async function memberReplyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  const locale = await getLocale();
  if (!member) return redirect({ href: "/m/login", locale });
  const parsed = z
    .object({ caseId: z.uuid(), body: z.string().trim().min(1, "empty").max(2000, "tooLong") })
    .safeParse({ caseId: formData.get("caseId"), body: formData.get("body") });
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  const request = await getMemberCase(member, parsed.data.caseId);
  if (!request) return fail({ form: ["notFound"] });
  if (request.status === "CLOSED") return fail({ form: ["closed"] });
  await memberReply(request.id, member.id, parsed.data.body);
  // Refresh the page in place rather than redirecting to the same URL with
  // "#conversation": a hash-only change is treated as in-page navigation and
  // doesn't reload the data, so the member's first reply didn't appear.
  revalidatePath("/[locale]/m/(app)/requests/[id]", "page");
  return { success: true };
}

// ------------------------------------------------------- medication orders

/** The order screen's medication search (signed-in members only). */
export async function searchMedicationsAction(q: string) {
  const member = await getCurrentMember();
  if (!member || !member.isCovered) return [];
  return searchCatalogForMember(String(q ?? "").slice(0, 80));
}

/** Places a medication order: the form sends one JSON field. Problems come
 * back as codes keyed by section (MemberOrder.error.*). */
export async function placeMedicationOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  const locale = await getLocale();
  if (!member) return redirect({ href: "/m/login", locale });
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("order") ?? ""));
  } catch {
    return fail({ form: ["invalid"] });
  }
  const parsed = medicationOrderSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= [issue.message];
    return fail(errors);
  }
  const contactPhone = normalizeCallbackPhone(parsed.data.contactPhone, member.country?.iso2?.trim() ?? "SN");
  if (!contactPhone) return fail({ contactPhone: ["phone"] });
  let caseId: string;
  try {
    caseId = (await createMemberMedicationOrder(member, parsed.data, contactPhone)).id;
    // Pick the pharmacies to ask straight away (staff then send). Never
    // blocks the order if it fails — staff can add pharmacies by hand.
    await prepareQuotesForCase(caseId).catch((e) => console.error("prepareQuotes failed", e));
  } catch (err) {
    if (err instanceof OrderRejectedError) return fail(err.errors);
    throw err;
  }
  return redirect({ href: `/m/requests/${caseId}?sent=1`, locale });
}

// ------------------------------------------------ order price and payment

export type OrderStepState = { ok: true } | { ok: false; error: string } | null;

function stepError(err: unknown): OrderStepState {
  if (err instanceof OrderStepError) return { ok: false, error: err.message };
  throw err;
}

async function signedIn() {
  const member = await getCurrentMember();
  if (!member) redirect({ href: "/m/login", locale: await getLocale() });
  return member!;
}

/** The member approves (or declines) the price of their order. */
export async function respondToPriceAction(_prev: OrderStepState, formData: FormData): Promise<OrderStepState> {
  const member = await signedIn();
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { ok: false, error: "notFound" };
  try {
    if (formData.get("decision") === "approve") await approvePrice({ member, caseId: caseId.data });
    else await declinePrice(member, caseId.data, String(formData.get("reason") ?? "").trim().slice(0, 500) || null);
  } catch (err) {
    return stepError(err);
  }
  revalidatePath("/[locale]/m/(app)/requests/[id]", "page");
  return { ok: true };
}

/** "I've paid": staff then check it against Nomad's account. */
export async function reportPaymentAction(_prev: OrderStepState, formData: FormData): Promise<OrderStepState> {
  const member = await signedIn();
  const parsed = z
    .object({ caseId: z.uuid(), method: z.enum(["WAVE", "ORANGE_MONEY", "OTHER"]), reference: z.string().trim().max(80).optional() })
    .safeParse({ caseId: formData.get("caseId"), method: formData.get("method"), reference: formData.get("reference") || undefined });
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    await reportPayment(member, parsed.data.caseId, parsed.data.method, parsed.data.reference ?? null);
  } catch (err) {
    return stepError(err);
  }
  revalidatePath("/[locale]/m/(app)/requests/[id]", "page");
  return { ok: true };
}

