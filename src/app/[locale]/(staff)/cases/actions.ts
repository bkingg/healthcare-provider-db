"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentActor } from "@/lib/actor";
import { canWorkCases, requireWorkCases } from "@/lib/rbac";
import { fail, type ActionResult } from "@/lib/validation/common";
import { GeocodeThrottledError, GeocodeUpstreamError } from "@/lib/geocode";
import * as ops from "@/data/caseOps";
import { addAction, NotACaseWorkerError, setActionDone, type NewAction } from "@/data/caseActions";
import { parseDueInput } from "@/lib/caseActions";
import { normalizeCallbackPhone } from "@/lib/phone";
import { staffCaseFormObject, staffCaseSchema, type StaffCaseInput } from "@/lib/validation/staffCase";
import { createStaffCase, findMembersForCase, setCaseCoverage, setCaseVisibility, StaffCaseError } from "@/data/staffCases";
import { findProviderForTag, tagProvider, taggingContext, untagProvider } from "@/data/caseProviderTags";
import { parseProviderNumber } from "@/lib/providerNumber";
import { addPharmacyToOrder, chooseQuote, QuoteAnswerError, saveQuoteAnswer, sendQuote } from "@/data/pharmacyQuotes";
import { approvePrice, confirmPayment, OrderStepError, payPharmacy, rejectPayment, resendPrice, sendPrice, setOrderPaymentLink } from "@/data/orderPayments";
import { quoteAnswerSchema } from "@/lib/validation/quoteAnswer";
import {
  bookCourier,
  confirmFeePaid,
  DeliveryStepError,
  markFailed,
  markOriginalCollected,
  markPickedUp,
  staffMarksDelivered,
  staffMarksReady,
  waiveCharge,
} from "@/data/orderDelivery";
import type { QuoteFormState } from "@/app/[locale]/q/actions";
import { prisma } from "@/lib/prisma";
import { recordReplySent } from "@/data/copilot";

/** Every case action re-checks canWorkCases server-side — the nav link and
 * pages hide behind it too, but a form POST doesn't. */
async function requireCaseWorker() {
  const actor = await getCurrentActor();
  requireWorkCases(actor);
  return actor;
}

function refresh() {
  revalidatePath("/[locale]/(staff)/cases", "layout");
}

const id = z.uuid();
const text = (label: string) => z.string().trim().min(1, `${label} can't be empty.`).max(4000);

/** A next action's fields from a form (the actions panel, or the "add a
 * next action" line under the note box). Errors are message codes the
 * screen translates (Cases.actionError.*). */
function parseActionFields(formData: FormData): { ok: true; action: NewAction } | { ok: false; errors: Record<string, string[]> } {
  const title = String(formData.get("actionTitle") ?? "").trim();
  const ownerId = String(formData.get("actionOwnerId") ?? "");
  const dueAt = parseDueInput(String(formData.get("actionDue") ?? ""));
  if (!title || title.length > 200) return { ok: false, errors: { actionTitle: ["title"] } };
  if (!id.safeParse(ownerId).success) return { ok: false, errors: { actionOwnerId: ["owner"] } };
  if (!dueAt) return { ok: false, errors: { actionDue: ["due"] } };
  // A few minutes' grace for time spent typing; anything earlier is a slip.
  if (dueAt.getTime() < Date.now() - 5 * 60_000) return { ok: false, errors: { actionDue: ["duePast"] } };
  return { ok: true, action: { title, ownerId, dueAt } };
}

export async function assignCaseAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const raw = String(formData.get("assigneeId") ?? "");
  const assigneeId = raw === "ME" ? actor.id : raw ? id.parse(raw) : null;
  await ops.assignCase(caseId, assigneeId, actor.id);
  refresh();
}

export async function setCaseStatusAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const status = z.enum(["NEW", "IN_PROGRESS", "WAITING_MEMBER", "RESOLVED", "CLOSED"]).parse(formData.get("status"));
  await ops.setCaseStatus(caseId, status, actor.id, formData.get("closeOpenActions") === "1");
  refresh();
}

export async function addNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ caseId: id, body: text("The note"), templateId: z.union([id, z.literal("")]).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  let action: NewAction | undefined;
  if (formData.get("withAction") === "1") {
    const fields = parseActionFields(formData);
    if (!fields.ok) return fail(fields.errors);
    action = fields.action;
  }
  try {
    await ops.addInternalNote(parsed.data.caseId, parsed.data.body, actor.id, parsed.data.templateId || undefined, action);
  } catch (err) {
    if (err instanceof NotACaseWorkerError) return fail({ actionOwnerId: ["owner"] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function addCaseActionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const fields = parseActionFields(formData);
  if (!fields.ok) return fail(fields.errors);
  try {
    await addAction(caseId, fields.action, actor.id);
  } catch (err) {
    if (err instanceof NotACaseWorkerError) return fail({ actionOwnerId: ["owner"] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function setActionDoneAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await setActionDone(id.parse(formData.get("actionId")), formData.get("done") === "1", actor.id);
  refresh();
}

export async function messageMemberAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z.object({ caseId: id, body: text("The message") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  try {
    await ops.messageMember(parsed.data.caseId, parsed.data.body, actor.id);
  } catch (err) {
    if (err instanceof ops.CaseHiddenFromMemberError) return fail({ form: ["hiddenFromMember"] });
    throw err;
  }
  // Started from a copilot draft: note whether it went as is or edited.
  const aiUsageId = id.safeParse(formData.get("aiUsageId"));
  if (aiUsageId.success) await recordReplySent(aiUsageId.data, parsed.data.body, actor.id, parsed.data.caseId);
  refresh();
  return { success: true };
}

export async function overrideColourAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ caseId: id, rag: z.enum(["GREEN", "YELLOW", "RED"]), reason: text("The reason") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  await ops.overrideColour(parsed.data.caseId, parsed.data.rag, parsed.data.reason, actor.id);
  refresh();
  return { success: true };
}

export async function findProvidersAction(_prev: ActionResult<{ count: number; radiusKm: number }> | null, formData: FormData): Promise<ActionResult<{ count: number; radiusKm: number }>> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  try {
    const result = await ops.findProvidersForCase(caseId, actor.id);
    refresh();
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof ops.NoLocationError) return fail({ form: ["noLocation"] });
    if (err instanceof GeocodeThrottledError || err instanceof GeocodeUpstreamError) return fail({ form: ["geocodeUnavailable"] });
    throw err;
  }
}

export async function toggleProviderAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await ops.toggleProviderSelected(id.parse(formData.get("caseId")), id.parse(formData.get("providerId")), actor.id);
  refresh();
}

// ------------------------------------------------------------- new staff case

/** Every problem with the New case form, keyed by field ("newPerson.email",
 * "actionDue"…), as message codes the form translates. */
export async function createStaffCaseAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCaseWorker();
  const errors: Record<string, string[]> = {};
  const parsed = staffCaseSchema.safeParse(staffCaseFormObject(formData));
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path.join(".")] ??= [issue.message];

  const phone = normalizeCallbackPhone(String(formData.get("contactPhone") ?? ""), "SN");
  if (!phone) errors.contactPhone ??= ["phone"];

  let action: StaffCaseInput["action"];
  if (formData.get("withAction") === "1") {
    const fields = parseActionFields(formData);
    if (fields.ok) action = fields.action;
    else Object.assign(errors, fields.errors);
  }
  if (!parsed.success || Object.keys(errors).length) return fail(errors);

  const { colourRag, colourReason, ...form } = parsed.data;
  try {
    const created = await createStaffCase(
      { ...form, contactPhone: phone!, colour: colourRag ? { rag: colourRag, reason: colourReason ?? "" } : undefined, action },
      actor.id,
    );
    refresh();
    return { success: true, data: { id: created.id } };
  } catch (err) {
    if (err instanceof StaffCaseError) return fail({ [err.field]: [err.code] });
    if (err instanceof NotACaseWorkerError) return fail({ actionOwnerId: ["owner"] });
    throw err;
  }
}

/** Member lookup for the New case form (name, member ID, phone, email). */
export async function findMembersForCaseAction(q: string) {
  await requireCaseWorker();
  const rows = await findMembersForCase(String(q ?? "").slice(0, 100));
  return rows.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
    memberNumber: m.memberNumber,
    organization: m.organization?.name ?? null,
    isCovered: m.isCovered,
    phone: m.phone,
    email: m.email,
    household: m.household.map((h) => ({
      id: h.id,
      name: `${h.firstName} ${h.lastName}`,
      memberNumber: h.memberNumber,
      isPrimary: h.primaryMemberId === null,
      relationshipEn: h.relationship?.nameEn ?? null,
      relationshipFr: h.relationship?.nameFr ?? null,
      isCovered: h.isCovered,
      dateOfBirth: h.dateOfBirth ? h.dateOfBirth.toISOString().slice(0, 10) : null,
      phone: h.phone,
    })),
  }));
}

export type MemberMatch = Awaited<ReturnType<typeof findMembersForCaseAction>>[number];

export async function setCaseCoverageAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const coverage = z.enum(["COVERED", "SPECIAL_FREE", "SPECIAL_PAID"]).parse(formData.get("coverage"));
  try {
    await setCaseCoverage(caseId, coverage, actor.id);
  } catch (err) {
    if (err instanceof StaffCaseError) return fail({ [err.field]: [err.code] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function setCaseVisibilityAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await setCaseVisibility(id.parse(formData.get("caseId")), formData.get("visible") === "1", actor.id);
  refresh();
}

// ---------------------------------------------------------- provider tags

/** "Tag by ID" preview: the provider a typed NMD ID points at, or null. */
export async function findProviderForTagAction(raw: string) {
  await requireCaseWorker();
  const n = parseProviderNumber(String(raw ?? ""), { allowBare: true });
  return n === null ? null : findProviderForTag(n);
}

export async function tagProviderAction(caseId: string, providerId: string): Promise<{ ok: boolean }> {
  const actor = await requireCaseWorker();
  await tagProvider(id.parse(caseId), id.parse(providerId), actor.id);
  refresh();
  return { ok: true };
}

export async function untagProviderAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await untagProvider(id.parse(formData.get("caseId")), id.parse(formData.get("providerId")), actor.id);
  refresh();
}

/** For the tagging bar in Provider search. Null if the case is gone or the
 * user can't work cases (the bar then simply doesn't show). */
export async function taggingContextAction(caseId: string) {
  const actor = await getCurrentActor();
  if (!canWorkCases(actor)) return null;
  const parsed = id.safeParse(caseId);
  return parsed.success ? taggingContext(parsed.data) : null;
}

// ---------------------------------------------------- pharmacy quotes (step 3)

/** This site's address as the pharmacy will open it (APP_BASE_URL when set,
 * else the address staff are using). */
async function baseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Makes a fresh private link and returns the WhatsApp message to send. */
export async function sendQuoteAction(quoteId: string) {
  const actor = await requireCaseWorker();
  const result = await sendQuote(id.parse(quoteId), actor.id, await baseUrl());
  refresh();
  return result;
}

export async function addPharmacyAction(orderId: string, providerId: string): Promise<void> {
  await requireCaseWorker();
  await addPharmacyToOrder(id.parse(orderId), id.parse(providerId));
  refresh();
}

/** Staff enter an answer a pharmacy gave by phone. */
export async function enterQuoteAnswerAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const actor = await requireCaseWorker();
  const quoteId = id.safeParse(formData.get("quoteId"));
  if (!quoteId.success) return { ok: false, error: "invalid" };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("answer") ?? ""));
  } catch {
    return { ok: false, error: "invalid" };
  }
  const parsed = quoteAnswerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  // Not yet sent (answered on the phone straight away): count it as sent now.
  await prisma.pharmacyQuote.updateMany({ where: { id: quoteId.data, sentAt: null }, data: { sentAt: new Date(), sentById: actor.id } });
  try {
    await saveQuoteAnswer(quoteId.data, parsed.data.decline ? { ...parsed.data, lines: [] } : parsed.data, { staffId: actor.id });
  } catch (err) {
    if (err instanceof QuoteAnswerError) return { ok: false, error: ["decided", "locked"].includes(err.message) ? err.message : "invalid" };
    throw err;
  }
  refresh();
  return { ok: true, declined: parsed.data.decline };
}

export async function chooseQuoteAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  const orderId = id.parse(formData.get("orderId"));
  const quoteId = id.parse(formData.get("quoteId"));
  const order = await prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, select: { chosenQuoteId: true, status: true } });
  if (order.chosenQuoteId === quoteId) return;
  // Another pharmacy only until the member has approved a price.
  if (!["SEARCHING_PHARMACIES", "PHARMACY_CONFIRMED", "AWAITING_APPROVAL"].includes(order.status)) return;
  if (order.chosenQuoteId) await prisma.medicationOrder.update({ where: { id: orderId }, data: { chosenQuoteId: null } });
  await chooseQuote(orderId, quoteId, actor.id);
  refresh();
}

// ------------------------------------------- order price and payments (step 4)

export type StaffOrderState = { ok: true } | { ok: false; error: string } | null;

function orderError(err: unknown): StaffOrderState {
  if (err instanceof OrderStepError) return { ok: false, error: err.message };
  throw err;
}

/** Staff change the delivery or fee (with a reason) and re-send the price. */
export async function revisePriceAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ orderId: id, deliveryXof: z.coerce.number().int().min(0).max(1_000_000), feeXof: z.coerce.number().int().min(0).max(1_000_000), note: z.string().trim().min(3, "note").max(300) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "note" ? "note" : "invalid" };
  try {
    await sendPrice(parsed.data.orderId, actor.id, parsed.data);
  } catch (err) {
    return orderError(err);
  }
  refresh();
  return { ok: true };
}

/** Re-send the automatic price (e.g. after it expired). */
export async function resendPriceAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await resendPrice(id.parse(formData.get("orderId")), actor.id).catch((e) => {
    if (!(e instanceof OrderStepError)) throw e;
  });
  refresh();
}

/** The member approved by phone. */
export async function recordApprovalAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await approvePrice({ staffId: actor.id, orderId: id.parse(formData.get("orderId")) }).catch((e) => {
    if (!(e instanceof OrderStepError)) throw e;
  });
  refresh();
}

export async function confirmPaymentAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({
      orderId: id,
      paymentId: z.union([id, z.literal("")]).optional(),
      method: z.enum(["WAVE", "ORANGE_MONEY", "CASH", "OTHER"]),
      amountXof: z.coerce.number().int().min(1).max(10_000_000),
      reference: z.string().trim().max(80).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { orderId, paymentId, ...rest } = parsed.data;
  if (rest.method !== "CASH" && !rest.reference) return { ok: false, error: "reference" };
  try {
    await confirmPayment(orderId, actor.id, { ...rest, paymentId: paymentId || undefined, reference: rest.reference ?? null });
  } catch (err) {
    return orderError(err);
  }
  refresh();
  return { ok: true };
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await rejectPayment(id.parse(formData.get("orderId")), id.parse(formData.get("paymentId")), actor.id, String(formData.get("note") ?? "").slice(0, 300) || "Not found");
  refresh();
}

export async function payPharmacyAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ orderId: id, bankingPaymentId: id, amountXof: z.coerce.number().int().min(1).max(10_000_000), reference: z.string().trim().min(3, "reference").max(80) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "reference" ? "reference" : "invalid" };
  try {
    await payPharmacy(parsed.data.orderId, actor.id, parsed.data);
  } catch (err) {
    return orderError(err);
  }
  refresh();
  return { ok: true };
}

/** An exact-amount payment link for this order (from Wave / Orange Money). */
export async function setPaymentLinkAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  await requireCaseWorker();
  const orderId = id.parse(formData.get("orderId"));
  const raw = String(formData.get("url") ?? "").trim();
  if (raw && !/^https:\/\/[^\s]{4,500}$/.test(raw)) return { ok: false, error: "url" };
  await setOrderPaymentLink(orderId, raw || null);
  refresh();
  return { ok: true };
}

// -------------------------------------------------------- delivery (step 5)

function deliveryError(err: unknown): StaffOrderState {
  if (err instanceof DeliveryStepError) return { ok: false, error: err.message };
  throw err;
}

const orderIdField = z.uuid();
const reasonField = z.string().trim().min(3, "reason").max(300, "reason");

/** The pharmacy confirmed Nomad's payment by phone. */
export async function markReadyAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  try {
    await staffMarksReady(orderIdField.parse(formData.get("orderId")), actor.id);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

/** "Courier booked" (in Yango): tracking link, booking reference, what
 * Nomad paid, expected arrival (Dakar time = UTC), courier's name/phone.
 * Also used to update the booking. */
export async function bookCourierAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const text = (max: number) =>
    z
      .string()
      .trim()
      .max(max)
      .optional()
      .transform((v) => (v ? v : null));
  const parsed = z
    .object({
      orderId: orderIdField,
      trackingUrl: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || /^https:\/\/\S+$/i.test(v), "trackingUrl"),
      bookingRef: text(80),
      costXof: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v.replace(/[\s  ]/g, "") : ""))
        .refine((v) => v === "" || /^\d{1,7}$/.test(v), "costXof")
        .transform((v) => (v ? Number(v) : null)),
      etaAt: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? new Date(`${v}:00Z`) : null))
        .refine((d) => d === null || !Number.isNaN(d.getTime()), "etaAt"),
      courierName: text(80),
      courierPhone: text(40),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  if (!parsed.data.trackingUrl && !parsed.data.bookingRef) return { ok: false, error: "linkOrRef" };
  const { orderId, ...input } = parsed.data;
  try {
    await bookCourier(orderId, actor.id, input);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

export async function markOriginalCollectedAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  try {
    await markOriginalCollected(orderIdField.parse(formData.get("orderId")), actor.id);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

export async function markPickedUpAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  try {
    await markPickedUp(orderIdField.parse(formData.get("orderId")), actor.id);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

/** Staff mark it delivered — with why (the member normally confirms). */
export async function markDeliveredAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z.object({ orderId: orderIdField, note: reasonField }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  try {
    await staffMarksDelivered(parsed.data.orderId, actor.id, parsed.data.note);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

/** The courier couldn't hand it over: reason + re-delivery fee (0 = none). */
export async function markFailedAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ orderId: orderIdField, reason: reasonField, feeXof: z.coerce.number().int().min(0, "fee").max(1_000_000, "fee") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  try {
    await markFailed(parsed.data.orderId, actor.id, parsed.data.reason, parsed.data.feeXof);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

export async function waiveFeeAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z.object({ orderId: orderIdField, reason: reasonField }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  try {
    await waiveCharge(parsed.data.orderId, actor.id, parsed.data.reason);
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}

export async function confirmFeePaidAction(_prev: StaffOrderState, formData: FormData): Promise<StaffOrderState> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({
      orderId: orderIdField,
      method: z.enum(["WAVE", "ORANGE_MONEY", "CASH", "OTHER"]),
      reference: z
        .string()
        .trim()
        .max(80)
        .optional()
        .transform((v) => (v ? v : null)),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.method !== "CASH" && !parsed.data.reference) return { ok: false, error: "reference" };
  try {
    await confirmFeePaid(parsed.data.orderId, actor.id, { method: parsed.data.method, reference: parsed.data.reference });
  } catch (err) {
    return deliveryError(err);
  }
  refresh();
  return { ok: true };
}
