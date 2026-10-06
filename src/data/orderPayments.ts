import "server-only";
import { prisma } from "@/lib/prisma";
import { priceOrder, type PricingSettings } from "@/lib/orderPricing";
import type { CurrentMember } from "@/lib/memberAuth";
import type { PaymentMethod, Prisma } from "../../generated/prisma/client";
import { deliverySettings } from "./pharmacyQuotes";
import { getMemberCase } from "./memberApp";

/** The member's price, approval and payments for a medication order
 * (medication delivery, step 4). Every step writes a timeline entry; the
 * member's approval, decline and "I've paid" also tell the case manager. */

type Tx = Prisma.TransactionClient;

export class OrderStepError extends Error {}

function pricingSettings(s: Record<string, number>): PricingSettings {
  return {
    feeBaseXof: s.NOMAD_FEE_BASE_XOF,
    feePercent: s.NOMAD_FEE_PERCENT,
    nightSurchargeXof: s.NIGHT_SURCHARGE_XOF,
    nightStartHour: s.NIGHT_START_HOUR,
    nightEndHour: s.NIGHT_END_HOUR,
    roundXof: s.PRICE_ROUND_XOF,
  };
}

/** What the member would pay now, from the chosen quote. */
export async function currentPrice(orderId: string) {
  const [order, s] = await Promise.all([
    prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true, chosenQuote: { include: { lines: true } } } }),
    deliverySettings(),
  ]);
  if (!order.chosenQuote) throw new OrderStepError("noQuote");
  const deliveryEstimate = s.DELIVERY_BASE_XOF + (order.chosenQuote.distanceKm ?? 0) * s.DELIVERY_PER_KM_XOF;
  return { order, price: priceOrder(order.lines, order.chosenQuote.lines, deliveryEstimate, new Date(), pricingSettings(s)), settings: s };
}

async function setStatus(tx: Tx, orderId: string, status: Prisma.MedicationOrderUpdateInput["status"], by: { staffId?: string | null; memberId?: string }) {
  const o = await tx.medicationOrder.update({ where: { id: orderId }, data: { status } });
  await tx.caseEvent.create({ data: { caseId: o.caseId, type: "ORDER_STATUS_CHANGED", actorType: by.memberId ? "MEMBER" : by.staffId ? "STAFF" : "SYSTEM", staffId: by.staffId ?? null, memberId: by.memberId ?? null, data: { to: String(status) } } });
  return o;
}

/** Tells the case manager (or, if nobody's assigned, everyone who works
 * cases) through the bell. */
async function notifyOrderUpdate(tx: Tx, caseId: string, eventId: string) {
  const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId }, select: { assignedToId: true } });
  const userIds = c.assignedToId
    ? [c.assignedToId]
    : (await tx.user.findMany({ where: { isActive: true, role: { canWorkCases: true, isActive: true } }, select: { id: true } })).map((u) => u.id);
  for (const userId of userIds) await tx.staffNotification.create({ data: { userId, kind: "ORDER_UPDATE", caseId, eventId } });
}

/** Fixes and sends the member's price (automatically when a pharmacy is
 * chosen, or by staff revising delivery or fee with a reason). Only before
 * the member has approved. */
export async function sendPrice(orderId: string, staffId: string | null, override?: { deliveryXof: number; feeXof: number; note: string }) {
  const { order, price, settings } = await currentPrice(orderId);
  if (order.status !== "PHARMACY_CONFIRMED" && order.status !== "AWAITING_APPROVAL") throw new OrderStepError("locked");
  if (!price.items.some((i) => i.included)) throw new OrderStepError("nothingAvailable");
  const deliveryXof = override?.deliveryXof ?? price.deliveryXof;
  const feeXof = override?.feeXof ?? price.feeXof;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.medicationOrder.update({
      where: { id: orderId },
      data: {
        medicinesXof: price.medicinesXof,
        deliveryXof,
        feeXof,
        totalXof: price.medicinesXof + deliveryXof + feeXof,
        priceNote: override?.note ?? null,
        priceSentAt: now,
        priceValidUntil: new Date(now.getTime() + settings.PRICE_VALID_MINUTES * 60_000),
        approvedAt: null,
        approvedByStaffId: null,
        declinedAt: null,
        declineReason: null,
      },
    });
    await tx.caseEvent.create({
      data: { caseId: order.caseId, type: "PRICE_SENT", actorType: staffId ? "STAFF" : "SYSTEM", staffId, data: { totalXof: price.medicinesXof + deliveryXof + feeXof, revised: Boolean(override) } },
    });
    if (order.status !== "AWAITING_APPROVAL") await setStatus(tx, orderId, "AWAITING_APPROVAL", { staffId });
  });
}

/** Sends the price again with a fresh validity (e.g. after it expired),
 * keeping a staff revision of delivery or fee if there was one; medicines
 * are re-read from the chosen quote. */
export async function resendPrice(orderId: string, staffId: string) {
  const o = await prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, select: { priceNote: true, deliveryXof: true, feeXof: true } });
  const keep = o.priceNote && o.deliveryXof !== null && o.feeXof !== null ? { deliveryXof: o.deliveryXof, feeXof: o.feeXof, note: o.priceNote } : undefined;
  await sendPrice(orderId, staffId, keep);
}

async function memberOrder(member: CurrentMember, caseId: string) {
  const c = await getMemberCase(member, caseId);
  if (!c) throw new OrderStepError("notFound");
  return prisma.medicationOrder.findUniqueOrThrow({ where: { caseId: c.id } });
}

/** The member approves the price (in the app), or staff record an approval
 * given by phone. Must be within the price's validity. */
export async function approvePrice(target: { member: CurrentMember; caseId: string } | { staffId: string; orderId: string }) {
  const order = "member" in target ? await memberOrder(target.member, target.caseId) : await prisma.medicationOrder.findUniqueOrThrow({ where: { id: target.orderId } });
  if (order.status !== "AWAITING_APPROVAL") throw new OrderStepError("notAwaiting");
  if (!order.priceValidUntil || order.priceValidUntil < new Date()) throw new OrderStepError("priceExpired");
  const by = "member" in target ? { memberId: target.member.id } : { staffId: target.staffId };
  await prisma.$transaction(async (tx) => {
    await tx.medicationOrder.update({ where: { id: order.id }, data: { approvedAt: new Date(), approvedByStaffId: "staffId" in by ? by.staffId : null } });
    const e = await tx.caseEvent.create({
      data: { caseId: order.caseId, type: "PRICE_APPROVED", actorType: "memberId" in by ? "MEMBER" : "STAFF", memberId: "memberId" in by ? by.memberId : null, staffId: "staffId" in by ? by.staffId : null, data: { totalXof: order.totalXof } },
    });
    if ("memberId" in by) await notifyOrderUpdate(tx, order.caseId, e.id);
    await setStatus(tx, order.id, "AWAITING_PAYMENT", by);
  });
}

/** The member declines the price: the order is cancelled (they can tell
 * Nomad why; staff see it on the case). */
export async function declinePrice(member: CurrentMember, caseId: string, reason: string | null) {
  const order = await memberOrder(member, caseId);
  if (order.status !== "AWAITING_APPROVAL") throw new OrderStepError("notAwaiting");
  await prisma.$transaction(async (tx) => {
    await tx.medicationOrder.update({ where: { id: order.id }, data: { declinedAt: new Date(), declineReason: reason } });
    const e = await tx.caseEvent.create({ data: { caseId: order.caseId, type: "PRICE_DECLINED", actorType: "MEMBER", memberId: member.id, body: reason } });
    await notifyOrderUpdate(tx, order.caseId, e.id);
    await setStatus(tx, order.id, "CANCELLED", { memberId: member.id });
  });
}

/** The member says they've paid (optionally with the transaction id). Staff
 * then check it and confirm. */
export async function reportPayment(member: CurrentMember, caseId: string, method: PaymentMethod, reference: string | null) {
  const order = await memberOrder(member, caseId);
  if (order.status !== "AWAITING_PAYMENT" || !order.totalXof) throw new OrderStepError("notAwaitingPayment");
  const open = await prisma.medicationOrderPayment.count({ where: { orderId: order.id, direction: "FROM_MEMBER", status: "REPORTED" } });
  if (open) throw new OrderStepError("alreadyReported");
  await prisma.$transaction(async (tx) => {
    await tx.medicationOrderPayment.create({ data: { orderId: order.id, direction: "FROM_MEMBER", method, amountXof: order.totalXof!, status: "REPORTED", reference, reportedByMember: true } });
    const e = await tx.caseEvent.create({ data: { caseId: order.caseId, type: "PAYMENT_REPORTED", actorType: "MEMBER", memberId: member.id, body: reference, data: { method, amountXof: order.totalXof } } });
    await notifyOrderUpdate(tx, order.caseId, e.id);
  });
}

/** Staff confirm the member's payment — the one they reported, or a new one
 * (e.g. paid in cash or by phone). The order then counts as paid. */
export async function confirmPayment(orderId: string, staffId: string, input: { paymentId?: string; method: PaymentMethod; amountXof: number; reference: string | null }) {
  const order = await prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "AWAITING_PAYMENT") throw new OrderStepError("notAwaitingPayment");
  await prisma.$transaction(async (tx) => {
    if (input.paymentId) {
      await tx.medicationOrderPayment.update({
        where: { id: input.paymentId, orderId, direction: "FROM_MEMBER" },
        data: { status: "CONFIRMED", method: input.method, amountXof: input.amountXof, reference: input.reference || null, recordedById: staffId, confirmedAt: new Date() },
      });
    } else {
      await tx.medicationOrderPayment.create({
        data: { orderId, direction: "FROM_MEMBER", method: input.method, amountXof: input.amountXof, status: "CONFIRMED", reference: input.reference || null, recordedById: staffId, confirmedAt: new Date() },
      });
    }
    await tx.caseEvent.create({ data: { caseId: order.caseId, type: "PAYMENT_CONFIRMED", actorType: "STAFF", staffId, data: { method: input.method, amountXof: input.amountXof, reference: input.reference || null } } });
    await setStatus(tx, orderId, "PAID", { staffId });
  });
}

/** Staff couldn't find the payment the member reported (wrong amount, no
 * such transaction…): the member is asked to check and pay again. */
export async function rejectPayment(orderId: string, paymentId: string, staffId: string, note: string) {
  await prisma.medicationOrderPayment.update({ where: { id: paymentId, orderId, status: "REPORTED" }, data: { status: "REJECTED", note, recordedById: staffId } });
}

/** The chosen pharmacy's approved payment details (mobile money first). */
export async function pharmacyPayoutOptions(orderId: string) {
  const order = await prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, include: { chosenQuote: true } });
  if (!order.chosenQuote) return [];
  return prisma.bankingPayment.findMany({
    where: { providerId: order.chosenQuote.providerId, approvalStatus: "APPROVED" },
    include: { paymentType: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Nomad pays the pharmacy for the medicines — only to its approved
 * payment details. The order moves on to being prepared. */
export async function payPharmacy(orderId: string, staffId: string, input: { bankingPaymentId: string; amountXof: number; reference: string }) {
  const order = await prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, include: { chosenQuote: true } });
  if (order.status !== "PAID" || !order.chosenQuote) throw new OrderStepError("notPaid");
  const details = await prisma.bankingPayment.findFirst({ where: { id: input.bankingPaymentId, providerId: order.chosenQuote.providerId, approvalStatus: "APPROVED" }, include: { paymentType: true } });
  if (!details) throw new OrderStepError("details");
  const method: PaymentMethod = details.paymentType.code === "WAVE" ? "WAVE" : details.paymentType.code === "ORANGE_MONEY" ? "ORANGE_MONEY" : "OTHER";
  await prisma.$transaction(async (tx) => {
    await tx.medicationOrderPayment.create({
      data: { orderId, direction: "TO_PHARMACY", method, amountXof: input.amountXof, status: "CONFIRMED", reference: input.reference, providerId: order.chosenQuote!.providerId, bankingPaymentId: details.id, recordedById: staffId, confirmedAt: new Date() },
    });
    await tx.caseEvent.create({ data: { caseId: order.caseId, type: "PHARMACY_PAID", actorType: "STAFF", staffId, data: { amountXof: input.amountXof, method, reference: input.reference } } });
    await setStatus(tx, orderId, "PREPARING", { staffId });
  });
}

/** The links behind the member's "Pay with…" buttons: the order's own
 * exact-amount link if staff added one, else Nomad's standard links. */
export async function paymentLinksForOrder(order: { paymentLinkUrl: string | null }) {
  if (order.paymentLinkUrl) return [{ code: "ORDER", method: "OTHER" as PaymentMethod, labelEn: "Pay now", labelFr: "Payer maintenant", url: order.paymentLinkUrl }];
  return prisma.paymentLinkRef.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { code: true, method: true, labelEn: true, labelFr: true, url: true } });
}

export async function setOrderPaymentLink(orderId: string, url: string | null) {
  await prisma.medicationOrder.update({ where: { id: orderId }, data: { paymentLinkUrl: url } });
}
