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
