import { describe, expect, it } from "vitest";
import { compareQuotes, isoDayOfWeek, readyToChoose, timeBand, type QuoteForCompare } from "../quoteCompare";
import { rankPharmacies } from "../pharmacyRanking";

const now = new Date("2026-10-08T20:00:00Z");
const S = { deliveryBaseXof: 1000, deliveryPerKmXof: 200, courierMinutesPerKm: 3, urgentMarginPercent: 15, quoteValidMinutes: 120 };
const open = { status: "ACTIVE", isOpen24_7: true, officeHours: [] };
const order = (urgent: boolean, extra = {}) => ({ lines: [{ id: "L1", quantity: 2, label: "Paracétamol" }, { id: "L2", quantity: 1, label: "Insuline" }], hasNarcotic: false, hasColdChain: false, urgent, ...extra });
const q = (id: string, km: number, prep: number, prices: [number | null, number | null], over: Partial<QuoteForCompare> = {}): QuoteForCompare => ({
  id,
  providerName: id,
  status: "ANSWERED",
  answeredAt: new Date("2026-10-08T19:50:00Z"),
  distanceKm: km,
  provider: open,
  preparationMinutes: prep,
  canDispenseNarcotic: null,
  canPackColdChain: true,
  lines: [
    { orderLineId: "L1", availability: prices[0] === null ? "UNAVAILABLE" : "AVAILABLE", quantityOffered: null, packPriceXof: prices[0], substitution: null },
    { orderLineId: "L2", availability: prices[1] === null ? "UNAVAILABLE" : "AVAILABLE", quantityOffered: null, packPriceXof: prices[1], substitution: null },
  ],
  ...over,
});

describe("compareQuotes", () => {
  // Plateau: 18,500 meds, 5 km; Mermoz: 17,200, 7.5 km, slower; Médina: incomplete.
  const quotes = [q("Plateau", 5, 20, [1250, 16000]), q("Mermoz", 7.5, 32, [1100, 15000]), q("Médina", 2.5, 10, [1000, null])];

  it("not urgent: cheapest complete total wins", () => {
    const c = compareQuotes(order(false), quotes, S, now);
    expect(c.bestId).toBe("Mermoz");
    expect(c.rows.find((r) => r.id === "Mermoz")).toMatchObject({ medicinesXof: 17200, deliveryXof: 2500, totalXof: 19700, complete: true });
  });
  it("urgent: fastest complete wins when within the margin", () => {
    const c = compareQuotes(order(true), quotes, S, now);
    expect(c.bestId).toBe("Plateau");
    expect(c.rows.find((r) => r.id === "Plateau")?.doorMinutes).toBe(35);
  });
  it("urgent: cheapest wins when the fastest is too dear, and says so", () => {
    const c = compareQuotes(order(true), [q("Fast", 1, 5, [5000, 30000]), q("Cheap", 6, 40, [1000, 15000])], S, now);
    expect(c.bestId).toBe("Cheap");
    expect(c.fasterButDearer).toMatchObject({ quoteId: "Fast" });
  });
  it("skips quotes that can't handle the order", () => {
    const c = compareQuotes(order(false, { hasColdChain: true }), [q("NoCold", 1, 5, [1000, 10000], { canPackColdChain: false }), q("DNU", 1, 5, [900, 9000], { provider: { ...open, status: "DO_NOT_USE" } })], S, now);
    expect(c.bestId).toBeNull();
    expect(c.rows.map((r) => r.reason).sort()).toEqual(["doNotUse", "noColdChain"]);
  });
  it("closed or expired quotes don't count", () => {
    const closed = q("Closed", 1, 5, [1000, 10000], { provider: { status: "ACTIVE", isOpen24_7: false, officeHours: [] } });
    const old = q("Old", 1, 5, [1000, 10000], { answeredAt: new Date("2026-10-08T17:00:00Z") });
    expect(compareQuotes(order(false), [closed, old], S, now).rows.map((r) => r.reason).sort()).toEqual(["closed", "expired"]);
  });
  it("no complete quote: suggests who has the rest", () => {
    const c = compareQuotes(order(false), [q("A", 1, 5, [1000, null]), q("B", 2, 5, [null, 9000])], S, now);
    expect(c.bestId).toBeNull();
    expect(c.partial).toEqual({ quoteId: "A", missing: [{ lineId: "L2", label: "Insuline", elsewhere: ["B"] }] });
  });
  it("partly available counts only in the quantity asked", () => {
    const partial = q("P", 1, 5, [1000, 10000]);
    partial.lines[0] = { orderLineId: "L1", availability: "PARTIAL", quantityOffered: 1, packPriceXof: 1000, substitution: null };
    const c = compareQuotes(order(false), [partial], S, now);
    expect(c.rows[0]).toMatchObject({ complete: false, medicinesXof: 11000 });
  });
});

describe("readyToChoose", () => {
  const sent = new Date("2026-10-08T19:50:00Z");
  it("waits for everyone, or until the wait is over", () => {
    expect(readyToChoose([{ status: "ANSWERED", sentAt: sent }, { status: "SENT", sentAt: sent }], 15, new Date("2026-10-08T20:00:00Z"))).toBe(false);
    expect(readyToChoose([{ status: "ANSWERED", sentAt: sent }, { status: "SENT", sentAt: sent }], 15, new Date("2026-10-08T20:06:00Z"))).toBe(true);
    expect(readyToChoose([{ status: "ANSWERED", sentAt: sent }, { status: "DECLINED", sentAt: sent }], 15, new Date("2026-10-08T19:55:00Z"))).toBe(true);
    expect(readyToChoose([{ status: "SENT", sentAt: sent }], 15, new Date("2026-10-08T23:00:00Z"))).toBe(false);
    // A pharmacy picked but not sent yet still counts as waiting.
    expect(readyToChoose([{ status: "ANSWERED", sentAt: sent }, { status: "PREPARED", sentAt: null }], 15, new Date("2026-10-08T19:55:00Z"))).toBe(false);
  });
});

describe("rankPharmacies", () => {
  it("drops DO NOT USE, then open first, nearest, best record", () => {
    const point = { lat: 14.7, lng: -17.45 };
    const ps = [
      { id: "far24", status: "ACTIVE", isOpen24_7: true, officeHours: [], lat: 14.76, lng: -17.44 },
      { id: "nearClosed", status: "ACTIVE", isOpen24_7: false, officeHours: [], lat: 14.7, lng: -17.451 },
      { id: "dnu", status: "DO_NOT_USE", isOpen24_7: true, officeHours: [], lat: 14.7, lng: -17.45 },
      { id: "near24", status: "ACTIVE", isOpen24_7: true, officeHours: [], lat: 14.701, lng: -17.45 },
    ];
    expect(rankPharmacies(ps, point, now).map((p) => p.id)).toEqual(["near24", "far24", "nearClosed"]);
  });
});

describe("price history time", () => {
  it("bands and weekdays in Dakar time", () => {
    expect(timeBand(new Date("2026-10-08T22:30:00Z"))).toBe("NIGHT");
    expect(timeBand(new Date("2026-10-08T19:00:00Z"))).toBe("EVENING");
    expect(timeBand(new Date("2026-10-08T09:00:00Z"))).toBe("DAY");
    expect(isoDayOfWeek(new Date("2026-10-11T12:00:00Z"))).toBe(7);
  });
});
