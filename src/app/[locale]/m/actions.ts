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
import { PhoneSignInError, quickStartMember, requestPhoneCode, signInWithPhone, verifyPhoneCode, type PhoneProfile } from "@/lib/memberPhoneAuth";
import { maskPhone } from "@/lib/phoneSignIn";
import { savePrimaryAddress, removePrimaryAddress } from "@/data/memberAddresses";
import { memberAddressSchema } from "@/lib/validation/memberAddress";
import { memberFeatures } from "@/data/memberAppFeatures";

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

// ------------------------------------------------------------ phone sign-in

export type PhoneSignInState =
  | { stage: "code"; phone: string; masked: string; devCode?: string; error?: string }
  | { stage: "choose"; profiles: PhoneProfile[] }
  | { stage: "quickStart"; masked: string; error?: string }
  | { stage: "phone"; error: string }
  | null;

const signInError = (err: unknown) => {
  if (err instanceof PhoneSignInError) return err.message;
  throw err;
};

/** Step 1: send a WhatsApp code to the number. */
export async function requestPhoneCodeAction(_prev: PhoneSignInState, formData: FormData): Promise<PhoneSignInState> {
  const locale = await getLocale();
  try {
    const { phone, devCode } = await requestPhoneCode(String(formData.get("phone") ?? ""), String(formData.get("country") ?? "SN"), locale === "en" ? "en" : "fr");
    return { stage: "code", phone: phone.e164, masked: maskPhone(phone.international), devCode };
  } catch (err) {
    return { stage: "phone", error: signInError(err) };
  }
}

/** Step 2: the code. One profile on the number signs straight in; several
 * (a household sharing a phone) are offered; none starts a new account. */
export async function verifyPhoneCodeAction(prev: PhoneSignInState, formData: FormData): Promise<PhoneSignInState> {
  const phone = String(formData.get("phone") ?? "");
  const masked = prev?.stage === "code" ? prev.masked : "";
  let result: Awaited<ReturnType<typeof verifyPhoneCode>>;
  try {
    result = await verifyPhoneCode(phone, String(formData.get("code") ?? ""));
  } catch (err) {
    const error = signInError(err);
    return error === "startAgain" || error === "invalidPhone" ? { stage: "phone", error } : { stage: "code", phone, masked, error };
  }
  if (result.profiles.length === 1) return chooseProfile(result.profiles[0].id);
  if (result.profiles.length > 1) return { stage: "choose", profiles: result.profiles };
  return { stage: "quickStart", masked: maskPhone(result.phone.international) };
}

async function chooseProfile(memberId: string): Promise<PhoneSignInState> {
  let language: string;
  try {
    ({ language } = await signInWithPhone(memberId));
  } catch (err) {
    return { stage: "phone", error: signInError(err) };
  }
  return redirect({ href: "/m", locale: language === "en" ? "en" : "fr" });
}

/** Step 3a: which household member is signing in. */
export async function choosePhoneProfileAction(_prev: PhoneSignInState, formData: FormData): Promise<PhoneSignInState> {
  return chooseProfile(String(formData.get("memberId") ?? ""));
}

const quickStartSchema = z.object({
  firstName: z.string().trim().min(1, "firstName").max(100),
  lastName: z.string().trim().min(1, "lastName").max(100),
  consent: z.literal("1", "consent"),
});

/** Step 3b: a number Nomad doesn't know — name and consent, and the
 * member is in, not covered. */
export async function quickStartAction(prev: PhoneSignInState, formData: FormData): Promise<PhoneSignInState> {
  const masked = prev?.stage === "quickStart" ? prev.masked : "";
  const parsed = quickStartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { stage: "quickStart", masked, error: parsed.error.issues[0]?.message ?? "invalid" };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  try {
    await quickStartMember({ firstName: parsed.data.firstName, lastName: parsed.data.lastName, language: locale });
  } catch (err) {
    return { stage: "phone", error: signInError(err) };
  }
  // Next: the primary address (skippable), then home with a welcome.
  return redirect({ href: "/m/address?welcome=1", locale });
}

/** One entry point for the sign-in screen, which keeps a single state
 * through the steps: the form says which step it is. */
export async function phoneSignInAction(prev: PhoneSignInState, formData: FormData): Promise<PhoneSignInState> {
  switch (formData.get("step")) {
    case "send":
      return requestPhoneCodeAction(prev, formData);
    case "verify":
      return verifyPhoneCodeAction(prev, formData);
    case "choose":
      return choosePhoneProfileAction(prev, formData);
    case "quickStart":
      return quickStartAction(prev, formData);
    default:
      return { stage: "phone", error: "startAgain" };
  }
}

// ---------------------------------------------------------- primary address

export type AddressState = { ok: false; error: string } | null;

/** Saves the member's primary address, then goes on — to the home page
 * (with the welcome message after quick start). */
export async function savePrimaryAddressAction(_prev: AddressState, formData: FormData): Promise<AddressState> {
  const locale = await getLocale();
  const member = await getCurrentMember();
  if (!member) return redirect({ href: "/m/login", locale });
  const blank = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v ? v : undefined;
  };
  const parsed = memberAddressSchema.safeParse({ addressText: blank("addressText") ?? "", directions: blank("directions"), latitude: blank("latitude"), longitude: blank("longitude") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  await savePrimaryAddress(member.id, parsed.data);
  revalidatePath("/[locale]/m", "layout");
  return redirect({ href: formData.get("welcome") === "1" ? "/m?welcome=1" : "/m?addressSaved=1", locale });
}

export async function removePrimaryAddressAction(): Promise<void> {
  const locale = await getLocale();
  const member = await getCurrentMember();
  if (!member) return redirect({ href: "/m/login", locale });
  await removePrimaryAddress(member.id);
  revalidatePath("/[locale]/m", "layout");
  redirect({ href: "/m/address", locale });
}

export async function signOutMemberAction(): Promise<void> {
  await signOutMember();
  redirect({ href: "/m/login", locale: await getLocale() });
}

export async function createRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  const locale = await getLocale();
  if (!member) return redirect({ href: "/m/login", locale });
  // Held back for now (Admin > Value lists > Member app features).
  if (!(await memberFeatures(member)).REQUEST_HELP) return fail({ form: ["This service isn't available in the app yet. Please call Nomad."] });

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
  if (!member) return [];
  return searchCatalogForMember(String(q ?? "").slice(0, 80));
}

/** Places a medication order: the form sends one JSON field. Problems come
 * back as codes keyed by section (MemberOrder.error.*). */
export async function placeMedicationOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  const locale = await getLocale();
  if (!member) return redirect({ href: "/m/login", locale });
  if (!(await memberFeatures(member)).ORDER_MEDICATION) return fail({ form: ["unavailable"] });
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
    if (parsed.data.saveAsPrimary) {
      await savePrimaryAddress(member.id, {
        addressText: parsed.data.deliveryAddress,
        directions: parsed.data.deliveryNotes ?? null,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      });
    }
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

