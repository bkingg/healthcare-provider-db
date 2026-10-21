import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { schedulePush } from "@/lib/push";
import { formatDakarDateTime } from "@/lib/formatDate";
import { deliverBy, fillTemplate } from "@/lib/deliveryPromise";
import type { CurrentMember } from "@/lib/memberAuth";
import type { PaymentMethod, Prisma } from "../../generated/prisma/client";
import { deliverySettings } from "./pharmacyQuotes";
import { getMemberCase } from "./memberApp";

/** Medication delivery, step 5 — after Nomad pays the pharmacy:
 *   pharmacy confirms the payment (on its link)    → READY_FOR_PICKUP
 *   staff book the courier in Yango and record it  → COURIER_REQUESTED
 *   (controlled medicine: paper prescription taken) → ORIGINAL_COLLECTED
 *   picked up at the pharmacy                       → PICKED_UP
 *   member taps "I've received it" (or staff)       → DELIVERED
 *   courier couldn't hand it over                   → DELIVERY_FAILED
 *     (re-delivery fee due; paid or waived → READY_FOR_PICKUP again)
 * Each step posts an automatic message in the member's chat (templates in
 * Admin) and writes the timeline; steps the member or pharmacy take ring
 * the staff bell. */

type Tx = Prisma.TransactionClient;
export class DeliveryStepError extends Error {}

const xof = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

async function setStatus(tx: Tx, orderId: string, status: Prisma.MedicationOrderUpdateInput["status"], by: { staffId?: string | null; memberId?: string | null }) {
  const o = await tx.medicationOrder.update({ where: { id: orderId }, data: { status } });
  await tx.caseEvent.create({
    data: { caseId: o.caseId, type: "ORDER_STATUS_CHANGED", actorType: by.memberId ? "MEMBER" : by.staffId ? "STAFF" : "SYSTEM", staffId: by.staffId ?? null, memberId: by.memberId ?? null, data: { to: String(status) } },
  });
  return o;
}

/** Rings the bell for the case's manager — or everyone who works cases. */
export async function notifyStaff(tx: Tx, caseId: string, eventId: string) {
  const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId }, select: { assignedToId: true } });
  const userIds = c.assignedToId
    ? [c.assignedToId]
    : (await tx.user.findMany({ where: { isActive: true, role: { canWorkCases: true, isActive: true } }, select: { id: true } })).map((u) => u.id);
  for (const userId of userIds) await tx.staffNotification.create({ data: { userId, kind: "ORDER_UPDATE", caseId, eventId } });
  schedulePush();
}

/** Posts an automatic message (Admin > Automatic messages) in the member's
 * request chat, in their language. Nothing is posted when the template is
 * switched off or missing. */
export async function postAutoMessage(tx: Tx, caseId: string, code: string, vars: Record<string, string | null | undefined> = {}) {
  const tpl = await tx.memberMessageTemplate.findFirst({ where: { code, isActive: true, enabled: true } });
  if (!tpl) return;
  const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId }, select: { requestedBy: { select: { preferredLanguage: true } } } });
  const fr = c.requestedBy.preferredLanguage !== "en";
  const body = fillTemplate(fr ? (tpl.bodyFr ?? tpl.bodyEn) : tpl.bodyEn, vars);
  if (!body) return;
  await tx.caseEvent.create({ data: { caseId, type: "MESSAGE_TO_MEMBER", actorType: "SYSTEM", body, visibleToMember: true, data: { auto: code } } });
  schedulePush();
}

async function memberLocale(caseId: string, tx: Tx = prisma) {
  const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId }, select: { requestedBy: { select: { preferredLanguage: true } } } });
  return c.requestedBy.preferredLanguage === "en" ? "en" : "fr";
}

/** "Expected delivery: by Oct 21, 23:59." in the member's language. */
async function deliverByLine(promisedBy: Date | null, locale: string) {
  if (!promisedBy) return "";
  const t = await getTranslations({ locale, namespace: "OrderAuto" });
  return t("deliverBy", { when: formatDakarDateTime(promisedBy, locale) });
}

async function etaText(etaAt: Date | null, locale: string) {
  if (!etaAt) return "";
  const t = await getTranslations({ locale, namespace: "OrderAuto" });
  return t("eta", { when: formatDakarDateTime(etaAt, locale) });
}

// ------------------------------------------------- hooks from earlier steps

/** Step 2 → member: "we've received your order". */
export async function onOrderReceived(tx: Tx, caseId: string, caseNumber: number) {
  await postAutoMessage(tx, caseId, "ORDER_RECEIVED", { reference: `CAS-${String(caseNumber).padStart(6, "0")}` });
}

/** Step 4 → member: "your price is ready". */
export async function onPriceSent(tx: Tx, caseId: string, totalXof: number) {
  await postAutoMessage(tx, caseId, "PRICE_READY", { total: xof(totalXof) });
}

/** Step 4 → member's payment confirmed: fix the deliver-by deadline from
 * the timeframe they chose, and tell them. */
export async function onMemberPaid(tx: Tx, orderId: string, paidAt: Date) {
  const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, include: { case: { select: { id: true, urgency: true } } } });
  const promisedBy = deliverBy(order.case.urgency, paidAt);
  await tx.medicationOrder.update({ where: { id: orderId }, data: { promisedBy } });
  const locale = await memberLocale(order.caseId, tx);
  await postAutoMessage(tx, order.caseId, "PAYMENT_RECEIVED", { total: xof(order.totalXof ?? 0), deliverBy: await deliverByLine(promisedBy, locale) });
}

/** Step 4 → Nomad paid the pharmacy: keep its link open so it can confirm. */
export async function onPharmacyPaid(tx: Tx, quoteId: string) {
  const s = await deliverySettings();
  await tx.pharmacyQuote.update({ where: { id: quoteId }, data: { expiresAt: new Date(Date.now() + s.PHARMACY_LINK_DAYS * 24 * 60 * 60 * 1000) } });
}

// ------------------------------------------------------------- ready

async function markReady(orderId: string, by: { staffId: string | null }, how: "PHARMACY" | "STAFF") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PREPARING") throw new DeliveryStepError("notPreparing");
    await tx.medicationOrder.update({ where: { id: orderId }, data: { readyAt: new Date() } });
    await setStatus(tx, orderId, "READY_FOR_PICKUP", { staffId: by.staffId });
    const e = await tx.caseEvent.create({
      data: { caseId: order.caseId, type: "PHARMACY_PAYMENT_CONFIRMED", actorType: by.staffId ? "STAFF" : "SYSTEM", staffId: by.staffId, data: { how } },
    });
    // The pharmacy confirming is news for staff: book the courier.
    if (how === "PHARMACY") await notifyStaff(tx, order.caseId, e.id);
    await postAutoMessage(tx, order.caseId, "READY_FOR_PICKUP");
  });
}

/** On the pharmacy's link: "I've received Nomad's payment". */
export async function pharmacyConfirmsPayment(quoteId: string) {
  const q = await prisma.pharmacyQuote.findUniqueOrThrow({ where: { id: quoteId }, include: { order: true } });
  if (q.order.chosenQuoteId !== q.id) throw new DeliveryStepError("notChosen");
  await markReady(q.orderId, { staffId: null }, "PHARMACY");
}

/** Staff record a confirmation the pharmacy gave by phone. */
export async function staffMarksReady(orderId: string, staffId: string) {
  await markReady(orderId, { staffId }, "STAFF");
}

// ------------------------------------------------------------- courier

export type CourierInput = { trackingUrl: string | null; bookingRef: string | null; costXof: number | null; etaAt: Date | null; courierName: string | null; courierPhone: string | null };

/** Staff booked the courier (in Yango) — or update the booking. */
export async function bookCourier(orderId: string, staffId: string, input: CourierInput) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, include: { deliveries: { orderBy: { attempt: "desc" }, take: 1 } } });
    const current = order.deliveries[0];
    const active = current && !current.deliveredAt && !current.failedAt;
    if (order.status === "READY_FOR_PICKUP" && !active) {
      await tx.medicationDelivery.create({
        data: { orderId, attempt: (current?.attempt ?? 0) + 1, ...input, collectOriginal: order.hasNarcotic, bookedById: staffId },
      });
      await setStatus(tx, orderId, "COURIER_REQUESTED", { staffId });
      await tx.caseEvent.create({ data: { caseId: order.caseId, type: "COURIER_BOOKED", actorType: "STAFF", staffId, data: { trackingUrl: input.trackingUrl, eta: input.etaAt?.toISOString() ?? null } } });
      const locale = await memberLocale(order.caseId, tx);
      await postAutoMessage(tx, order.caseId, order.hasNarcotic ? "COURIER_BOOKED_ORIGINAL" : "COURIER_BOOKED", { eta: await etaText(input.etaAt, locale) });
      return;
    }
    if (active && ["COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP"].includes(order.status)) {
      await tx.medicationDelivery.update({ where: { id: current.id }, data: input });
      return;
    }
    throw new DeliveryStepError("notReady");
  });
}

async function activeDelivery(tx: Tx, orderId: string) {
  const d = await tx.medicationDelivery.findFirst({ where: { orderId, deliveredAt: null, failedAt: null }, orderBy: { attempt: "desc" } });
  if (!d) throw new DeliveryStepError("noCourier");
  return d;
}

/** Controlled medicine: the courier has the paper prescription. */
export async function markOriginalCollected(orderId: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "COURIER_REQUESTED") throw new DeliveryStepError("wrongStep");
    const d = await activeDelivery(tx, orderId);
    await tx.medicationDelivery.update({ where: { id: d.id }, data: { originalCollectedAt: new Date() } });
    await setStatus(tx, orderId, "ORIGINAL_COLLECTED", { staffId });
  });
}

/** Picked up at the pharmacy — on its way to the member. */
export async function markPickedUp(orderId: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    const ok = order.status === "ORIGINAL_COLLECTED" || (order.status === "COURIER_REQUESTED" && !order.hasNarcotic);
    if (!ok) throw new DeliveryStepError("wrongStep");
    const d = await activeDelivery(tx, orderId);
    await tx.medicationDelivery.update({ where: { id: d.id }, data: { pickedUpAt: new Date() } });
    await setStatus(tx, orderId, "PICKED_UP", { staffId });
    await postAutoMessage(tx, order.caseId, "ON_THE_WAY");
  });
}

const ON_ITS_WAY = ["COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP"];

async function markDelivered(orderId: string, by: { staffId: string; note: string } | { memberId: string }) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (!ON_ITS_WAY.includes(order.status)) throw new DeliveryStepError("wrongStep");
    const d = await activeDelivery(tx, orderId);
    const isMember = "memberId" in by;
    await tx.medicationDelivery.update({
      where: { id: d.id },
      data: { deliveredAt: new Date(), deliveredConfirmedBy: isMember ? "MEMBER" : "STAFF", deliveredNote: isMember ? null : by.note, pickedUpAt: d.pickedUpAt ?? new Date() },
    });
    await setStatus(tx, orderId, "DELIVERED", isMember ? { memberId: by.memberId } : { staffId: by.staffId });
    const e = await tx.caseEvent.create({
      data: {
        caseId: order.caseId,
        type: "DELIVERY_RECEIVED",
        actorType: isMember ? "MEMBER" : "STAFF",
        memberId: isMember ? by.memberId : null,
        staffId: isMember ? null : by.staffId,
        body: isMember ? null : by.note,
      },
    });
    if (isMember) await notifyStaff(tx, order.caseId, e.id);
    await postAutoMessage(tx, order.caseId, "DELIVERED");
  });
}

/** The member taps "I've received it". */
export async function memberConfirmsReceived(member: CurrentMember, caseId: string) {
  const c = await getMemberCase(member, caseId);
  if (!c) throw new DeliveryStepError("notFound");
  const order = await prisma.medicationOrder.findUniqueOrThrow({ where: { caseId: c.id } });
  await markDelivered(order.id, { memberId: member.id });
}

/** Staff mark it delivered (e.g. the member confirmed by phone) — with why. */
export async function staffMarksDelivered(orderId: string, staffId: string, note: string) {
  await markDelivered(orderId, { staffId, note });
}

// ---------------------------------------------------------- failed delivery

/** The courier couldn't hand it over: a re-delivery fee is due (by default
 * the order's delivery price; 0 = no fee) and the member is told. */
export async function markFailed(orderId: string, staffId: string, reason: string, feeXof: number) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (!ON_ITS_WAY.includes(order.status)) throw new DeliveryStepError("wrongStep");
    const d = await activeDelivery(tx, orderId);
    await tx.medicationDelivery.update({ where: { id: d.id }, data: { failedAt: new Date(), failReason: reason } });
    await tx.caseEvent.create({ data: { caseId: order.caseId, type: "DELIVERY_FAILED", actorType: "STAFF", staffId, body: reason, data: { feeXof } } });
    if (feeXof > 0) {
      await tx.medicationOrderCharge.create({ data: { orderId, kind: "REDELIVERY", amountXof: feeXof, reason, createdById: staffId } });
      await setStatus(tx, orderId, "DELIVERY_FAILED", { staffId });
      await postAutoMessage(tx, order.caseId, "DELIVERY_FAILED", { reason, fee: xof(feeXof) });
    } else {
      // No fee: straight back to booking a new courier.
      await setStatus(tx, orderId, "READY_FOR_PICKUP", { staffId });
      await tx.medicationOrder.update({ where: { id: orderId }, data: { readyAt: new Date(), alertBookCourierAt: null } });
      await postAutoMessage(tx, order.caseId, "FEE_WAIVED");
    }
  });
}

async function dueCharge(tx: Tx, orderId: string) {
  const c = await tx.medicationOrderCharge.findFirst({ where: { orderId, status: "DUE" }, orderBy: { createdAt: "desc" } });
  if (!c) throw new DeliveryStepError("noCharge");
  return c;
}

async function backToReady(tx: Tx, orderId: string, staffId: string | null) {
  await setStatus(tx, orderId, "READY_FOR_PICKUP", { staffId });
  await tx.medicationOrder.update({ where: { id: orderId }, data: { readyAt: new Date(), alertBookCourierAt: null } });
}

/** Staff cancel the re-delivery fee (with a reason). */
export async function waiveCharge(orderId: string, staffId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    const charge = await dueCharge(tx, orderId);
    await tx.medicationOrderCharge.update({ where: { id: charge.id }, data: { status: "WAIVED", waivedReason: reason, waivedById: staffId, waivedAt: new Date() } });
    await tx.caseEvent.create({ data: { caseId: order.caseId, type: "REDELIVERY_FEE_WAIVED", actorType: "STAFF", staffId, body: reason, data: { feeXof: charge.amountXof } } });
    await backToReady(tx, orderId, staffId);
    await postAutoMessage(tx, order.caseId, "FEE_WAIVED");
  });
}

/** The member says they paid the re-delivery fee (method + transaction id). */
export async function memberReportsFeePaid(member: CurrentMember, caseId: string, method: PaymentMethod, reference: string) {
  const c = await getMemberCase(member, caseId);
  if (!c) throw new DeliveryStepError("notFound");
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { caseId: c.id } });
    const charge = await dueCharge(tx, order.id);
    await tx.medicationOrderCharge.update({ where: { id: charge.id }, data: { paymentMethod: method, paymentReference: reference, reportedAt: new Date() } });
    const e = await tx.caseEvent.create({ data: { caseId: c.id, type: "PAYMENT_REPORTED", actorType: "MEMBER", memberId: member.id, body: reference, data: { method, amountXof: charge.amountXof, redelivery: true } } });
    await notifyStaff(tx, c.id, e.id);
  });
}

/** Staff confirm the re-delivery fee arrived (or record it themselves). */
export async function confirmFeePaid(orderId: string, staffId: string, input: { method: PaymentMethod; reference: string | null }) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.medicationOrder.findUniqueOrThrow({ where: { id: orderId } });
    const charge = await dueCharge(tx, orderId);
    await tx.medicationOrderCharge.update({
      where: { id: charge.id },
      data: { status: "PAID", paidAt: new Date(), confirmedById: staffId, paymentMethod: input.method, paymentReference: input.reference ?? charge.paymentReference },
    });
    await tx.caseEvent.create({ data: { caseId: order.caseId, type: "REDELIVERY_FEE_PAID", actorType: "STAFF", staffId, data: { feeXof: charge.amountXof, reference: input.reference } } });
    await backToReady(tx, orderId, staffId);
    await postAutoMessage(tx, order.caseId, "FEE_PAID");
  });
}

// ------------------------------------------------------------ staff nudges

/** Checked whenever staff open the case list or a case (no background
 * jobs yet): rings the bell once when an order is ready but no courier is
 * booked, when the pharmacy hasn't confirmed Nomad's payment, or when the
 * promised delivery time has passed. */
export async function refreshDeliveryAlerts(now = new Date()) {
  const s = await deliverySettings();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
  const [notBooked, unconfirmed, late] = await Promise.all([
    prisma.medicationOrder.findMany({ where: { status: "READY_FOR_PICKUP", alertBookCourierAt: null, readyAt: { lt: minutesAgo(s.COURIER_BOOKING_ALERT_MINUTES) } }, select: { id: true, caseId: true } }),
    prisma.medicationOrder.findMany({
      where: { status: "PREPARING", alertPharmacyAt: null, payments: { some: { direction: "TO_PHARMACY", status: "CONFIRMED", confirmedAt: { lt: minutesAgo(s.PHARMACY_CONFIRM_ALERT_MINUTES) } } } },
      select: { id: true, caseId: true },
    }),
    prisma.medicationOrder.findMany({
      where: { alertLateAt: null, promisedBy: { lt: now }, status: { in: ["PAID", "PREPARING", "READY_FOR_PICKUP", "COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP", "DELIVERY_FAILED"] } },
      select: { id: true, caseId: true },
    }),
  ]);
  const ring = async (orders: { id: string; caseId: string }[], type: "ALERT_BOOK_COURIER" | "ALERT_PHARMACY_UNCONFIRMED" | "ALERT_DELIVERY_LATE", field: "alertBookCourierAt" | "alertPharmacyAt" | "alertLateAt") => {
    for (const o of orders) {
      await prisma.$transaction(async (tx) => {
        // Claimed first, so two staff opening the list at once ring it once.
        const claimed = await tx.medicationOrder.updateMany({ where: { id: o.id, [field]: null }, data: { [field]: now } });
        if (claimed.count !== 1) return;
        const e = await tx.caseEvent.create({ data: { caseId: o.caseId, type, actorType: "SYSTEM" } });
        await notifyStaff(tx, o.caseId, e.id);
      });
    }
  };
  await ring(notBooked, "ALERT_BOOK_COURIER", "alertBookCourierAt");
  await ring(unconfirmed, "ALERT_PHARMACY_UNCONFIRMED", "alertPharmacyAt");
  await ring(late, "ALERT_DELIVERY_LATE", "alertLateAt");
}
