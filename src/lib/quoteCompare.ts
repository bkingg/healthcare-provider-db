import { isOpenAt, type OfficeHoursRow } from "./openNow";

/** Comparing pharmacies' quotes for one medication order (step 3).
 *
 * 1. Only valid quotes count: answered, still valid, pharmacy not DO NOT
 *    USE and open now, and — when the order needs it — confirmed able to
 *    dispense a narcotic / pack cold-chain items.
 * 2. Complete quotes (every item, in the quantity asked) come first.
 * 3. Not urgent: lowest total for the member (medicines + estimated
 *    delivery). Urgent: soonest at the door (preparation + travel), unless
 *    that costs more than the margin over the cheapest — then the cheapest,
 *    with the faster option pointed out for staff.
 * 4. Ties: closer, then whoever answered first.
 * No complete quote → nothing is chosen; staff get a suggestion of who has
 * what. Prices are in FCFA. */

export type CompareSettings = { deliveryBaseXof: number; deliveryPerKmXof: number; courierMinutesPerKm: number; urgentMarginPercent: number; quoteValidMinutes: number };

export type OrderForCompare = { lines: { id: string; quantity: number; label: string }[]; hasNarcotic: boolean; hasColdChain: boolean; urgent: boolean };

export type QuoteForCompare = {
  id: string;
  providerName: string;
  status: string;
  answeredAt: Date | null;
  distanceKm: number | null;
  provider: { status: string; isOpen24_7: boolean; officeHours: OfficeHoursRow[] };
  preparationMinutes: number | null;
  canDispenseNarcotic: boolean | null;
  canPackColdChain: boolean | null;
  lines: { orderLineId: string; availability: string; quantityOffered: number | null; packPriceXof: number | null; substitution: string | null }[];
};

export type ComparedQuote = {
  id: string;
  providerName: string;
  eligible: boolean;
  /** Why not eligible (a code for the screen to translate). */
  reason: "notAnswered" | "expired" | "doNotUse" | "closed" | "noNarcotic" | "noColdChain" | null;
  complete: boolean;
  coveredLineIds: string[];
  medicinesXof: number;
  deliveryXof: number;
  totalXof: number;
  doorMinutes: number;
  hasSubstitution: boolean;
};

export type Comparison = {
  rows: ComparedQuote[];
  bestId: string | null;
  /** Urgent order where the fastest was dearer than the margin allows. */
  fasterButDearer: { quoteId: string; percentMore: number } | null;
  /** No complete quote: the best partial one, and who has the rest. */
  partial: { quoteId: string; missing: { lineId: string; label: string; elsewhere: string[] }[] } | null;
};

const covers = (l: QuoteForCompare["lines"][number], quantity: number) =>
  l.availability === "AVAILABLE" || (l.availability === "PARTIAL" && (l.quantityOffered ?? 0) >= quantity);

export function compareQuotes(order: OrderForCompare, quotes: QuoteForCompare[], s: CompareSettings, now: Date): Comparison {
  const rows: ComparedQuote[] = quotes.map((q) => {
    const priced = order.lines.map((ol) => {
      const ql = q.lines.find((l) => l.orderLineId === ol.id);
      const qty = !ql || ql.availability === "UNAVAILABLE" ? 0 : ql.availability === "PARTIAL" ? Math.min(ql.quantityOffered ?? 0, ol.quantity) : ol.quantity;
      return { ol, ql, qty, cost: qty * (ql?.packPriceXof ?? 0), covered: ql ? covers(ql, ol.quantity) : false };
    });
    const medicinesXof = priced.reduce((sum, p) => sum + p.cost, 0);
    const deliveryXof = Math.round(s.deliveryBaseXof + (q.distanceKm ?? 0) * s.deliveryPerKmXof);
    const doorMinutes = (q.preparationMinutes ?? 0) + Math.round((q.distanceKm ?? 0) * s.courierMinutesPerKm);
    let reason: ComparedQuote["reason"] = null;
    if (q.status !== "ANSWERED" || !q.answeredAt) reason = "notAnswered";
    else if (now.getTime() > q.answeredAt.getTime() + s.quoteValidMinutes * 60_000) reason = "expired";
    else if (q.provider.status !== "ACTIVE") reason = "doNotUse";
    else if (!isOpenAt(q.provider, now)) reason = "closed";
    else if (order.hasNarcotic && q.canDispenseNarcotic !== true) reason = "noNarcotic";
    else if (order.hasColdChain && q.canPackColdChain !== true) reason = "noColdChain";
    return {
      id: q.id,
      providerName: q.providerName,
      eligible: reason === null,
      reason,
      complete: priced.every((p) => p.covered),
      coveredLineIds: priced.filter((p) => p.covered).map((p) => p.ol.id),
      medicinesXof,
      deliveryXof,
      totalXof: medicinesXof + deliveryXof,
      doorMinutes,
      hasSubstitution: q.lines.some((l) => Boolean(l.substitution)),
    };
  });

  const byAnswer = new Map(quotes.map((q) => [q.id, q.answeredAt?.getTime() ?? Infinity]));
  const byDistance = new Map(quotes.map((q) => [q.id, q.distanceKm ?? Infinity]));
  const tie = (a: ComparedQuote, b: ComparedQuote) => byDistance.get(a.id)! - byDistance.get(b.id)! || byAnswer.get(a.id)! - byAnswer.get(b.id)!;

  const complete = rows.filter((r) => r.eligible && r.complete);
  let bestId: string | null = null;
  let fasterButDearer: Comparison["fasterButDearer"] = null;
  if (complete.length) {
    const cheapest = [...complete].sort((a, b) => a.totalXof - b.totalXof || tie(a, b))[0];
    if (order.urgent) {
      const fastest = [...complete].sort((a, b) => a.doorMinutes - b.doorMinutes || a.totalXof - b.totalXof || tie(a, b))[0];
      const percentMore = cheapest.totalXof > 0 ? Math.round(((fastest.totalXof - cheapest.totalXof) / cheapest.totalXof) * 100) : 0;
      if (percentMore <= s.urgentMarginPercent) bestId = fastest.id;
      else {
        bestId = cheapest.id;
        fasterButDearer = { quoteId: fastest.id, percentMore };
      }
    } else bestId = cheapest.id;
  }

  let partial: Comparison["partial"] = null;
  if (!bestId) {
    const candidates = rows.filter((r) => r.eligible && r.coveredLineIds.length > 0).sort((a, b) => b.coveredLineIds.length - a.coveredLineIds.length || a.totalXof - b.totalXof);
    if (candidates.length) {
      const top = candidates[0];
      partial = {
        quoteId: top.id,
        missing: order.lines
          .filter((ol) => !top.coveredLineIds.includes(ol.id))
          .map((ol) => ({ lineId: ol.id, label: ol.label, elsewhere: rows.filter((r) => r.eligible && r.id !== top.id && r.coveredLineIds.includes(ol.id)).map((r) => r.providerName) })),
      };
    }
  }
  rows.sort((a, b) => Number(b.id === bestId) - Number(a.id === bestId) || Number(b.eligible) - Number(a.eligible) || Number(b.complete) - Number(a.complete) || a.totalXof - b.totalXof);
  return { rows, bestId, fasterButDearer, partial };
}

/** Whether to choose now: every pharmacy picked has replied (answered,
 * declined or link expired — one picked but not sent yet still counts as
 * waiting), or the wait since the first request is over. */
export function readyToChoose(quotes: { status: string; sentAt: Date | null }[], waitMinutes: number, now: Date): boolean {
  const sent = quotes.filter((q) => q.sentAt);
  if (!sent.length || !sent.some((q) => q.status === "ANSWERED")) return false;
  if (quotes.every((q) => q.status !== "SENT" && q.status !== "PREPARED")) return true;
  const first = Math.min(...sent.map((q) => q.sentAt!.getTime()));
  return now.getTime() >= first + waitMinutes * 60_000;
}

/** Dakar (UTC+0) time band for the price history. */
export function timeBand(d: Date): "DAY" | "EVENING" | "NIGHT" {
  const h = d.getUTCHours();
  return h >= 7 && h < 18 ? "DAY" : h >= 18 && h < 22 ? "EVENING" : "NIGHT";
}

/** 1 = Monday … 7 = Sunday (Dakar). */
export function isoDayOfWeek(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1;
}
