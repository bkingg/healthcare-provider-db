import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rankPharmacies, type ResponseStats } from "@/lib/pharmacyRanking";
import { compareQuotes, isoDayOfWeek, readyToChoose, timeBand, type CompareSettings } from "@/lib/quoteCompare";
import { medicationLabel } from "@/lib/medications";
import { formatCaseNumber } from "@/lib/caseNumber";
import type { Prisma } from "../../generated/prisma/client";

/** Asking pharmacies about a medication order (medication delivery, step 3):
 * which pharmacies, the private quote links, their answers (which also feed
 * the price history), and choosing one. */

type Tx = Prisma.TransactionClient;

const DEFAULTS: Record<string, number> = {
  QUOTE_LINK_MINUTES: 120,
  PHARMACIES_TO_ASK: 3,
  QUOTE_WAIT_MINUTES: 15,
  QUOTE_WAIT_URGENT_MINUTES: 10,
  URGENT_PRICE_MARGIN_PERCENT: 15,
  DELIVERY_BASE_XOF: 1000,
  DELIVERY_PER_KM_XOF: 200,
  COURIER_MINUTES_PER_KM: 3,
  PRICE_OUTLIER_FACTOR: 3,
};

/** Admin > Value lists > Medication delivery settings, with safe defaults. */
export async function deliverySettings(): Promise<Record<keyof typeof DEFAULTS, number>> {
  const rows = await prisma.medicationDeliverySetting.findMany({ where: { isActive: true } });
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.code] = r.value;
  return out;
}

export function compareSettings(s: Record<string, number>): CompareSettings {
  return {
    deliveryBaseXof: s.DELIVERY_BASE_XOF,
    deliveryPerKmXof: s.DELIVERY_PER_KM_XOF,
    courierMinutesPerKm: s.COURIER_MINUTES_PER_KM,
    urgentMarginPercent: s.URGENT_PRICE_MARGIN_PERCENT,
    quoteValidMinutes: s.QUOTE_LINK_MINUTES,
  };
}

const pharmacyInclude = {
  names: { orderBy: { isPrimary: "desc" as const }, take: 1, select: { fullNameText: true } },
  addresses: { orderBy: { isPrimary: "desc" as const }, take: 1, select: { latitude: true, longitude: true, city: true, line1: true } },
  phones: { where: { isActive: true }, orderBy: { createdAt: "asc" as const }, take: 1, select: { number: true } },
  officeHours: { select: { dayOfWeek: true, openTime: true, closeTime: true } },
} satisfies Prisma.ProviderInclude;

/** Every provider marked as a pharmacy (Pharmacy capability), any status —
 * ranking leaves out the ones that can't be asked. */
export async function pharmacyCandidates() {
  const rows = await prisma.provider.findMany({ where: { capabilities: { some: { capability: { code: "PHARMACY" } } } }, include: pharmacyInclude });
  return rows.map((p) => ({
    id: p.id,
    providerNumber: p.providerNumber,
    name: p.names[0]?.fullNameText ?? String(p.providerNumber),
    status: p.status,
    isOpen24_7: p.isOpen24_7,
    officeHours: p.officeHours,
    lat: p.addresses[0]?.latitude ?? null,
    lng: p.addresses[0]?.longitude ?? null,
    city: p.addresses[0]?.city ?? null,
    phone: p.phones[0]?.number ?? null,
  }));
}

/** How often and how fast each pharmacy answered, over the last 90 days. */
export async function responseStats(): Promise<Map<string, ResponseStats>> {
  const quotes = await prisma.pharmacyQuote.findMany({ where: { sentAt: { gt: new Date(Date.now() - 90 * 86_400_000) } }, select: { providerId: true, sentAt: true, answeredAt: true } });
  const minutes = new Map<string, { asked: number; times: number[] }>();
  for (const q of quotes) {
    const m = minutes.get(q.providerId) ?? { asked: 0, times: [] };
    m.asked++;
    if (q.answeredAt && q.sentAt) m.times.push((q.answeredAt.getTime() - q.sentAt.getTime()) / 60_000);
    minutes.set(q.providerId, m);
  }
  return new Map(
    [...minutes].map(([id, m]) => {
      const sorted = [...m.times].sort((a, b) => a - b);
      return [id, { asked: m.asked, answered: sorted.length, medianMinutes: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null }];
    }),
  );
}

const point = (o: { deliveryLatitude: number | null; deliveryLongitude: number | null }) =>
  o.deliveryLatitude !== null && o.deliveryLongitude !== null ? { lat: o.deliveryLatitude, lng: o.deliveryLongitude } : null;

/** Picks the pharmacies to ask for a new order (the top N by ranking) and
 * prepares a request for each; staff then send them. Runs once per order. */
export async function prepareQuotes(orderId: string) {
  const order = await prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId }, include: { quotes: { select: { id: true } } } });
  if (order.quotes.length) return;
  const [s, candidates, stats] = await Promise.all([deliverySettings(), pharmacyCandidates(), responseStats()]);
  const ranked = rankPharmacies(candidates, point(order), new Date(), stats).slice(0, s.PHARMACIES_TO_ASK);
  await prisma.$transaction(async (tx) => {
    for (const [i, p] of ranked.entries()) {
      await tx.pharmacyQuote.create({ data: { orderId, providerId: p.id, rank: i + 1, distanceKm: p.distanceKm, openWhenAsked: p.openNow } });
    }
    if (order.status === "REQUESTED") await setOrderStatusTx(tx, orderId, "SEARCHING_PHARMACIES", null);
  });
}

async function setOrderStatusTx(tx: Tx, orderId: string, status: "SEARCHING_PHARMACIES" | "PHARMACY_CONFIRMED", staffId: string | null) {
  const o = await tx.medicationOrder.update({ where: { id: orderId }, data: { status } });
  await tx.caseEvent.create({ data: { caseId: o.caseId, type: "ORDER_STATUS_CHANGED", actorType: staffId ? "STAFF" : "SYSTEM", staffId, data: { to: status } } });
}

/** Staff add another pharmacy to ask (e.g. none answered, or a partial). */
export async function addPharmacyToOrder(orderId: string, providerId: string) {
  const [order, candidates, stats, count] = await Promise.all([
    prisma.medicationOrder.findUniqueOrThrow({ where: { id: orderId } }),
    pharmacyCandidates(),
    responseStats(),
    prisma.pharmacyQuote.count({ where: { orderId } }),
  ]);
  const p = rankPharmacies(candidates, point(order), new Date(), stats).find((c) => c.id === providerId);
  if (!p) throw new Error("Not a pharmacy that can be asked.");
  await prisma.pharmacyQuote.upsert({
    where: { orderId_providerId: { orderId, providerId } },
    create: { orderId, providerId, rank: count + 1, distanceKm: p.distanceKm, openWhenAsked: p.openNow },
    update: {},
  });
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** "Send": a fresh private link (any earlier one stops working), valid for
 * the set time, and the WhatsApp message to send with it. */
export async function sendQuote(quoteId: string, staffId: string, baseUrl: string) {
  const s = await deliverySettings();
  const token = randomBytes(24).toString("base64url");
  const q = await prisma.$transaction(async (tx) => {
    const q = await tx.pharmacyQuote.update({
      where: { id: quoteId },
      data: { tokenHash: hashToken(token), status: "SENT", sentAt: new Date(), sentById: staffId, expiresAt: new Date(Date.now() + s.QUOTE_LINK_MINUTES * 60_000), answeredAt: null },
      include: { order: { include: { case: { select: { id: true, caseNumber: true } }, lines: { orderBy: { sortOrder: "asc" } } } }, provider: { include: pharmacyInclude } },
    });
    await tx.caseEvent.create({ data: { caseId: q.order.case.id, type: "QUOTE_SENT", actorType: "STAFF", staffId, data: { quoteId: q.id, provider: q.provider.names[0]?.fullNameText ?? null } } });
    return q;
  });
  const link = `${baseUrl}/fr/q/${token}`;
  const items = q.order.lines.map((l) => `• ${l.freeText ?? medicationLabel({ dci: l.dci ?? "", strength: l.strength, form: l.form ?? "" })} × ${l.quantity}`).join("\n");
  const message = [
    `Bonjour ${q.provider.names[0]?.fullNameText ?? ""}, Nomad cherche pour un patient :`,
    items,
    // Plain text, no emoji: shows the same on every phone.
    q.order.hasNarcotic ? "ATTENTION : contient un stupéfiant (ordonnance originale remise par le coursier)." : null,
    q.order.hasColdChain ? "CHAÎNE DU FROID : contient un produit à conserver au froid." : null,
    `Merci d’indiquer disponibilité, prix et délai ici : ${link}`,
    `(lien valable ${Math.round(s.QUOTE_LINK_MINUTES / 60)} h · réf. ${formatCaseNumber(q.order.case.caseNumber)})`,
  ]
    .filter(Boolean)
    .join("\n");
  const digits = (q.provider.phones[0]?.number ?? "").replace(/\D/g, "");
  return { link, message, whatsappUrl: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null };
}

/** The quote behind a private link — or null when the link is unknown,
 * replaced, expired, or the order has moved on. */
export async function quoteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const q = await prisma.pharmacyQuote.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      provider: { include: pharmacyInclude },
      lines: true,
      order: {
        include: {
          lines: { orderBy: { sortOrder: "asc" } },
          documents: { include: { file: { select: { id: true, contentType: true } } } },
          patient: { select: { firstName: true, lastName: true, dateOfBirth: true } },
          case: { select: { caseNumber: true } },
        },
      },
    },
  });
  if (!q || !q.expiresAt || q.expiresAt < new Date()) return null;
  if (!["SENT", "ANSWERED", "DECLINED"].includes(q.status)) return null;
  if (q.order.chosenQuoteId && q.order.chosenQuoteId !== q.id) return null;
  return q;
}

export type QuoteAnswer = {
  decline: boolean;
  preparationMinutes?: number;
  canDispenseNarcotic?: boolean;
  canPackColdChain?: boolean;
  pharmacistName?: string;
  note?: string;
  lines: { orderLineId: string; availability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE"; quantityOffered?: number; packPriceXof?: number; packDescription?: string; unitsPerPack?: number; substitution?: string }[];
};

export class QuoteAnswerError extends Error {}

/** Saves a pharmacy's answer (on its link, or entered by staff from a call)
 * and adds every priced item to the price history. A pharmacy can update it
 * until the order is decided; staff can still record a late answer after
 * that (it doesn't change the choice, but its prices go into the history). */
export async function saveQuoteAnswer(quoteId: string, a: QuoteAnswer, by: { staffId: string } | null) {
  const s = await deliverySettings();
  const q = await prisma.pharmacyQuote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { order: { include: { lines: true, case: { select: { id: true } } } }, provider: { include: pharmacyInclude } },
  });
  if (!by && q.order.chosenQuoteId && q.order.chosenQuoteId !== q.id) throw new QuoteAnswerError("decided");
  const lineIds = new Set(q.order.lines.map((l) => l.id));
  if (!a.decline && (a.lines.length !== q.order.lines.length || a.lines.some((l) => !lineIds.has(l.orderLineId)))) throw new QuoteAnswerError("lines");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.pharmacyQuoteLine.deleteMany({ where: { quoteId } });
    await tx.pharmacyQuote.update({
      where: { id: quoteId },
      data: {
        status: a.decline ? "DECLINED" : "ANSWERED",
        answeredAt: now,
        preparationMinutes: a.decline ? null : (a.preparationMinutes ?? null),
        canDispenseNarcotic: q.order.hasNarcotic && !a.decline ? Boolean(a.canDispenseNarcotic) : null,
        canPackColdChain: q.order.hasColdChain && !a.decline ? Boolean(a.canPackColdChain) : null,
        pharmacistName: a.pharmacistName || null,
        note: a.note || null,
        enteredByStaff: Boolean(by),
      },
    });
    if (!a.decline) {
      const respMinutes = q.sentAt ? Math.round((now.getTime() - q.sentAt.getTime()) / 60_000) : null;
      for (const l of a.lines) {
        const ol = q.order.lines.find((x) => x.id === l.orderLineId)!;
        const line = await tx.pharmacyQuoteLine.create({
          data: {
            quoteId,
            orderLineId: l.orderLineId,
            availability: l.availability,
            quantityOffered: l.availability === "PARTIAL" ? (l.quantityOffered ?? null) : l.availability === "AVAILABLE" ? ol.quantity : 0,
            packPriceXof: l.availability === "UNAVAILABLE" ? null : (l.packPriceXof ?? null),
            packDescription: l.packDescription || null,
            unitsPerPack: l.unitsPerPack ?? null,
            substitution: l.substitution || null,
          },
        });
        if (line.packPriceXof === null) continue;
        // Unusual price: far from the median of earlier prices for this item.
        let isOutlier = false;
        if (ol.medicationId) {
          const earlier = await tx.medicationPriceObservation.findMany({ where: { medicationId: ol.medicationId, isOutlier: false }, select: { pricePerPackXof: true }, orderBy: { observedAt: "desc" }, take: 100 });
          if (earlier.length >= 3) {
            const sorted = earlier.map((e) => e.pricePerPackXof).sort((x, y) => x - y);
            const median = sorted[Math.floor(sorted.length / 2)];
            isOutlier = line.packPriceXof > median * s.PRICE_OUTLIER_FACTOR || line.packPriceXof * s.PRICE_OUTLIER_FACTOR < median;
          }
        }
        await tx.medicationPriceObservation.create({
          data: {
            observedAt: now,
            medicationId: ol.medicationId,
            itemLabel: ol.freeText ?? medicationLabel({ dci: ol.dci ?? "", strength: ol.strength, form: ol.form ?? "" }),
            packDescription: line.packDescription,
            unitsPerPack: line.unitsPerPack,
            pricePerPackXof: line.packPriceXof,
            pricePerUnitXof: line.unitsPerPack ? Math.round((line.packPriceXof / line.unitsPerPack) * 100) / 100 : null,
            providerId: q.providerId,
            city: q.provider.addresses[0]?.city ?? null,
            latitude: q.provider.addresses[0]?.latitude ?? null,
            longitude: q.provider.addresses[0]?.longitude ?? null,
            dayOfWeek: isoDayOfWeek(now),
            timeBand: timeBand(now),
            pharmacyOpen24_7: q.provider.isOpen24_7,
            availability: l.availability,
            isSubstitution: Boolean(line.substitution),
            responseMinutes: respMinutes,
            isOutlier,
            quoteLineId: line.id,
            quoteId,
          },
        });
      }
    }
    await tx.caseEvent.create({
      data: {
        caseId: q.order.case.id,
        type: "QUOTE_ANSWERED",
        actorType: by ? "STAFF" : "SYSTEM",
        staffId: by?.staffId ?? null,
        data: { quoteId, provider: q.provider.names[0]?.fullNameText ?? null, declined: a.decline },
      },
    });
  });
}

/** The order's quotes and their comparison — for the case page. */
export async function quotesForOrder(orderId: string, now = new Date()) {
  const [order, s] = await Promise.all([
    prisma.medicationOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        case: { select: { urgency: true, rag: true } },
        lines: { orderBy: { sortOrder: "asc" } },
        quotes: { include: { provider: { include: pharmacyInclude }, lines: true }, orderBy: { rank: "asc" } },
      },
    }),
    deliverySettings(),
  ]);
  const urgent = order.case.urgency === "TODAY" || order.case.urgency === "EMERGENCY" || order.case.rag !== "GREEN";
  const comparison = compareQuotes(
    {
      lines: order.lines.map((l) => ({ id: l.id, quantity: l.quantity, label: l.freeText ?? medicationLabel({ dci: l.dci ?? "", strength: l.strength, form: l.form ?? "" }) })),
      hasNarcotic: order.hasNarcotic,
      hasColdChain: order.hasColdChain,
      urgent,
    },
    order.quotes.map((q) => ({
      id: q.id,
      providerName: q.provider.names[0]?.fullNameText ?? "",
      status: q.status,
      answeredAt: q.answeredAt,
      distanceKm: q.distanceKm,
      provider: { status: q.provider.status, isOpen24_7: q.provider.isOpen24_7, officeHours: q.provider.officeHours },
      preparationMinutes: q.preparationMinutes,
      canDispenseNarcotic: q.canDispenseNarcotic,
      canPackColdChain: q.canPackColdChain,
      lines: q.lines,
    })),
    compareSettings(s),
    now,
  );
  return { order, urgent, comparison, settings: s };
}

/** Marks links that ran out unanswered, and — once everyone asked has
 * replied or the wait is over — chooses the best quote. Runs when staff
 * open the case (like the overdue check: no background job). */
export async function refreshQuotes(orderId: string, now = new Date()) {
  await prisma.pharmacyQuote.updateMany({ where: { orderId, status: "SENT", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
  const { order, urgent, comparison, settings } = await quotesForOrder(orderId, now);
  if (order.chosenQuoteId || order.status !== "SEARCHING_PHARMACIES" || !comparison.bestId) return;
  if (!readyToChoose(order.quotes, urgent ? settings.QUOTE_WAIT_URGENT_MINUTES : settings.QUOTE_WAIT_MINUTES, now)) return;
  await chooseQuote(orderId, comparison.bestId, null);
}

/** Choose a quote — automatically (staffId null) or by staff. */
export async function chooseQuote(orderId: string, quoteId: string, staffId: string | null) {
  await prisma.$transaction(async (tx) => {
    const q = await tx.pharmacyQuote.findFirstOrThrow({ where: { id: quoteId, orderId, status: "ANSWERED" }, include: { provider: { include: pharmacyInclude } } });
    const o = await tx.medicationOrder.update({ where: { id: orderId }, data: { chosenQuoteId: q.id } });
    await tx.caseEvent.create({ data: { caseId: o.caseId, type: "QUOTE_CHOSEN", actorType: staffId ? "STAFF" : "SYSTEM", staffId, data: { quoteId, provider: q.provider.names[0]?.fullNameText ?? null, auto: !staffId } } });
    await setOrderStatusTx(tx, orderId, "PHARMACY_CONFIRMED", staffId);
  });
}
