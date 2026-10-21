import "server-only";
import { prisma } from "@/lib/prisma";
import { priceOrder } from "@/lib/orderPricing";
import { medicationLabel } from "@/lib/medications";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatDakarDateTime } from "@/lib/formatDate";
import { localizedText } from "@/lib/localizedText";
import { paymentLinksForOrder } from "./orderPayments";
import type { MemberPriceView } from "@/app/[locale]/m/(app)/requests/[id]/order-price";
import type { StaffPaymentView } from "@/app/[locale]/(staff)/cases/_components/order-payment-panel";
import { staffLabel } from "@/lib/handle";
import { pharmacyPayoutOptions } from "./orderPayments";
import type { StaffDeliveryView } from "@/app/[locale]/(staff)/cases/_components/delivery-panel";
import type { MemberDeliveryView } from "@/app/[locale]/m/(app)/requests/[id]/delivery-section";

/** The member's price screen data — only once a price has been sent. Item
 * lines come from the chosen quote (fixed once a price is sent); the
 * totals are the ones fixed on the order. */
export async function memberPriceView(orderId: string, locale: string): Promise<MemberPriceView | null> {
  const o = await prisma.medicationOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      case: { select: { caseNumber: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      chosenQuote: { include: { lines: true } },
      payments: { where: { direction: "FROM_MEMBER" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!o.priceSentAt || o.totalXof === null || !o.chosenQuote) return null;
  const label = (l: (typeof o.lines)[number]) => l.freeText ?? medicationLabel({ dci: l.dci ?? "", strength: l.strength, form: l.form ?? "" });
  const priced = priceOrder(o.lines, o.chosenQuote.lines, 0, new Date(), { feeBaseXof: 0, feePercent: 0, nightSurchargeXof: 0, nightStartHour: 0, nightEndHour: 0, roundXof: 1 });
  const links = await paymentLinksForOrder(o);
  return {
    caseId: o.caseId,
    reference: formatCaseNumber(o.case.caseNumber),
    status: o.status,
    items: priced.items.filter((i) => i.included).map((i) => ({ label: label(o.lines.find((l) => l.id === i.lineId)!), quantity: i.quantity, unitXof: i.unitXof, subtotalXof: i.subtotalXof, substitution: i.substitution })),
    unavailable: priced.items.filter((i) => !i.included).map((i) => label(o.lines.find((l) => l.id === i.lineId)!)),
    medicinesXof: o.medicinesXof ?? 0,
    deliveryXof: o.deliveryXof ?? 0,
    feeXof: o.feeXof ?? 0,
    totalXof: o.totalXof,
    validUntil: o.priceValidUntil ? formatDakarDateTime(o.priceValidUntil, locale) : null,
    expired: Boolean(o.priceValidUntil && o.priceValidUntil < new Date()),
    links: links.map((l) => ({ code: l.code, method: l.method, label: localizedText(l.labelEn, l.labelFr, locale) ?? l.labelEn, url: l.url })),
    payment: o.payments[0] ? { status: o.payments[0].status, method: o.payments[0].method, note: o.payments[0].note } : null,
  };
}

/** The staff "Price & payment" panel data. */
export async function staffPaymentView(orderId: string, locale: string): Promise<StaffPaymentView> {
  const o = await prisma.medicationOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      payments: { orderBy: { createdAt: "asc" }, include: { recordedBy: { select: { name: true, email: true, handle: true } } } },
      chosenQuote: { include: { provider: { include: { names: { orderBy: { isPrimary: "desc" }, take: 1 } } } } },
    },
  });
  const [options, standardLinks] = await Promise.all([o.status === "PAID" ? pharmacyPayoutOptions(orderId) : Promise.resolve([]), prisma.paymentLinkRef.count({ where: { isActive: true } })]);
  const at = (d: Date) => formatDakarDateTime(d, locale);
  return {
    orderId: o.id,
    status: o.status,
    price:
      o.priceSentAt && o.totalXof !== null
        ? {
            medicinesXof: o.medicinesXof ?? 0,
            deliveryXof: o.deliveryXof ?? 0,
            feeXof: o.feeXof ?? 0,
            totalXof: o.totalXof,
            note: o.priceNote,
            sentAt: at(o.priceSentAt),
            validUntil: o.priceValidUntil ? at(o.priceValidUntil) : null,
            expired: Boolean(o.priceValidUntil && o.priceValidUntil < new Date()),
          }
        : null,
    approvedAt: o.approvedAt ? at(o.approvedAt) : null,
    approvedByPhone: Boolean(o.approvedByStaffId),
    declined: o.declinedAt ? { at: at(o.declinedAt), reason: o.declineReason } : null,
    paymentLinkUrl: o.paymentLinkUrl,
    standardLinks,
    payments: o.payments.map((p) => ({
      id: p.id,
      direction: p.direction,
      method: p.method,
      amountXof: p.amountXof,
      status: p.status,
      reference: p.reference,
      at: at(p.confirmedAt ?? p.createdAt),
      byMember: p.reportedByMember,
      who: p.recordedBy ? staffLabel(p.recordedBy) : null,
      note: p.note,
    })),
    payout: o.chosenQuote
      ? {
          pharmacy: o.chosenQuote.provider.names[0]?.fullNameText ?? null,
          options: options.map((b) => ({ id: b.id, label: `${b.paymentType.name} · ${b.mobileMoneyNumber ?? b.bankAccountNumber ?? "—"} · ${b.payeeName}` })),
        }
      : null,
  };
}

// ------------------------------------------------------- delivery (step 5)

const AFTER_PAYMENT = ["PREPARING", "READY_FOR_PICKUP", "COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP", "DELIVERED", "DELIVERY_FAILED"];

async function deliveryOrder(orderId: string) {
  return prisma.medicationOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      case: { select: { id: true, contactPhone: true, requestedBy: { select: { firstName: true, lastName: true } } } },
      patient: { select: { firstName: true, lastName: true } },
      chosenQuote: {
        include: {
          provider: {
            include: {
              names: { orderBy: { isPrimary: "desc" }, take: 1, select: { fullNameText: true } },
              addresses: { orderBy: { isPrimary: "desc" }, take: 1, select: { line1: true, city: true, latitude: true, longitude: true } },
              phones: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1, select: { number: true } },
            },
          },
        },
      },
      deliveries: { orderBy: { attempt: "asc" } },
      charges: { where: { status: "DUE" }, orderBy: { createdAt: "desc" }, take: 1 },
      payments: { where: { direction: "TO_PHARMACY", status: "CONFIRMED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

const mapUrl = (lat: number | null | undefined, lng: number | null | undefined) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null);

/** The staff Delivery panel's data, or null before Nomad pays the pharmacy. */
export async function staffDeliveryView(orderId: string, locale: string): Promise<StaffDeliveryView | null> {
  const o = await deliveryOrder(orderId);
  if (!AFTER_PAYMENT.includes(o.status)) return null;
  const at = (d: Date | null | undefined) => (d ? formatDakarDateTime(d, locale) : null);
  const p = o.chosenQuote?.provider;
  const pAddr = p?.addresses[0];
  const pharmacy = { kind: "PHARMACY" as const, name: p?.names[0]?.fullNameText ?? "—", address: [pAddr?.line1, pAddr?.city].filter(Boolean).join(", ") || "—", phone: p?.phones[0]?.number ?? null, mapUrl: mapUrl(pAddr?.latitude, pAddr?.longitude) };
  const memberName = `${o.patient.firstName} ${o.patient.lastName}`;
  const memberAddress = [o.deliveryAddress, o.deliveryNotes].filter(Boolean).join(" — ");
  const member = { kind: "MEMBER" as const, name: memberName, address: memberAddress, phone: o.case.contactPhone, mapUrl: mapUrl(o.deliveryLatitude, o.deliveryLongitude) };
  // A controlled medicine: collect the paper prescription from the member
  // first, then the pharmacy, then back to the member.
  const stops = o.hasNarcotic ? [{ ...member, kind: "MEMBER_ORIGINAL" as const }, pharmacy, member] : [pharmacy, member];
  const active = o.deliveries.find((d) => !d.deliveredAt && !d.failedAt) ?? null;
  const staffIds = [...new Set(o.deliveries.map((d) => d.bookedById).filter((x): x is string => Boolean(x)))];
  const staff = staffIds.length ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, email: true, handle: true } }) : [];
  const who = (id: string | null) => {
    const u = staff.find((s) => s.id === id);
    return u ? staffLabel(u) : null;
  };
  const charge = o.charges[0];
  const now = new Date();
  return {
    orderId: o.id,
    status: o.status,
    controlled: o.hasNarcotic,
    coldChain: o.hasColdChain,
    pharmacyName: pharmacy.name,
    pharmacyPaidAt: at(o.payments[0]?.confirmedAt),
    readyAt: at(o.readyAt),
    promisedBy: at(o.promisedBy),
    late: Boolean(o.promisedBy && o.promisedBy < now && o.status !== "DELIVERED"),
    stops,
    active: active && {
      trackingUrl: active.trackingUrl,
      bookingRef: active.bookingRef,
      costXof: active.costXof,
      etaAt: at(active.etaAt),
      etaInput: active.etaAt ? active.etaAt.toISOString().slice(0, 16) : "",
      courierName: active.courierName,
      courierPhone: active.courierPhone,
      bookedAt: at(active.bookedAt)!,
      bookedBy: who(active.bookedById),
    },
    history: o.deliveries
      .filter((d) => d.deliveredAt || d.failedAt)
      .map((d) => ({
        attempt: d.attempt,
        when: at(d.deliveredAt ?? d.failedAt)!,
        outcome: d.deliveredAt ? (d.deliveredConfirmedBy === "MEMBER" ? "DELIVERED_MEMBER" : "DELIVERED_STAFF") : "FAILED",
        note: d.deliveredAt ? d.deliveredNote : d.failReason,
        costXof: d.costXof,
        trackingUrl: d.trackingUrl,
      })),
    dueCharge: charge ? { amountXof: charge.amountXof, reason: charge.reason, reportedMethod: charge.paymentMethod, reportedRef: charge.paymentReference, reportedAt: at(charge.reportedAt) } : null,
    defaultFeeXof: o.deliveryXof ?? 0,
  };
}

const MEMBER_STEPS = ["PAID", "PREPARING", "READY_FOR_PICKUP", "COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP", "DELIVERED"] as const;

/** The member's Delivery section, from payment on; null before. */
export async function memberDeliveryView(orderId: string, locale: string): Promise<MemberDeliveryView | null> {
  const o = await deliveryOrder(orderId);
  if (o.status !== "PAID" && !AFTER_PAYMENT.includes(o.status)) return null;
  const steps = MEMBER_STEPS.filter((s) => s !== "ORIGINAL_COLLECTED" || o.hasNarcotic);
  // A failed delivery goes back to "ready" (a new courier is needed).
  const position = steps.indexOf((o.status === "DELIVERY_FAILED" ? "READY_FOR_PICKUP" : o.status) as (typeof steps)[number]);
  const active = o.deliveries.find((d) => !d.deliveredAt && !d.failedAt) ?? null;
  const delivered = [...o.deliveries].reverse().find((d) => d.deliveredAt);
  const charge = o.charges[0];
  const links = charge ? await paymentLinksForOrder({ paymentLinkUrl: null }) : [];
  return {
    caseId: o.case.id,
    status: o.status,
    controlled: o.hasNarcotic,
    promisedBy: o.promisedBy ? formatDakarDateTime(o.promisedBy, locale) : null,
    late: Boolean(o.promisedBy && o.promisedBy < new Date() && o.status !== "DELIVERED"),
    steps: steps.map((key, i) => ({ key, done: i < position || o.status === "DELIVERED", current: i === position && o.status !== "DELIVERED" })),
    active: active && { trackingUrl: active.trackingUrl, eta: active.etaAt ? formatDakarDateTime(active.etaAt, locale) : null, courierName: active.courierName, courierPhone: active.courierPhone },
    deliveredAt: delivered?.deliveredAt ? formatDakarDateTime(delivered.deliveredAt, locale) : null,
    fee: charge ? { amountXof: charge.amountXof, reported: Boolean(charge.reportedAt), links: links.map((l) => ({ code: l.code, method: l.method, label: localizedText(l.labelEn, l.labelFr, locale) ?? l.labelEn, url: l.url })) } : null,
  };
}
