import { describe, expect, it } from "vitest";
import { isNight, priceOrder, roundUp } from "../orderPricing";

const S = { feeBaseXof: 1000, feePercent: 5, nightSurchargeXof: 1000, nightStartHour: 22, nightEndHour: 7, roundXof: 100 };
const lines = [{ id: "L1", quantity: 2 }, { id: "L2", quantity: 1 }, { id: "L3", quantity: 3 }];
const chosen = [
  { orderLineId: "L1", availability: "AVAILABLE", quantityOffered: 2, packPriceXof: 1250, substitution: null },
  { orderLineId: "L2", availability: "AVAILABLE", quantityOffered: 1, packPriceXof: 4500, substitution: "Insuman Rapid instead" },
  { orderLineId: "L3", availability: "PARTIAL", quantityOffered: 1, packPriceXof: 800, substitution: null },
];

describe("priceOrder", () => {
  it("adds medicines, delivery (rounded up) and Nomad's fee", () => {
    const p = priceOrder(lines, chosen, 1080, new Date("2026-10-08T10:00:00Z"), S);
    expect(p.medicinesXof).toBe(2 * 1250 + 4500 + 800);
    expect(p.deliveryXof).toBe(1100);
    expect(p.feeXof).toBe(roundUp(1000 + 7800 * 0.05, 100));
    expect(p.totalXof).toBe(7800 + 1100 + 1400);
    expect(p.night).toBe(false);
    expect(p.items.find((i) => i.lineId === "L3")).toMatchObject({ quantity: 1, subtotalXof: 800, included: true });
    expect(p.items.find((i) => i.lineId === "L2")?.substitution).toBe("Insuman Rapid instead");
  });
  it("leaves out what the pharmacy doesn't have", () => {
    const p = priceOrder(lines, [chosen[0], { ...chosen[1], availability: "UNAVAILABLE", packPriceXof: null }], 1000, new Date("2026-10-08T10:00:00Z"), S);
    expect(p.items.filter((i) => !i.included).map((i) => i.lineId)).toEqual(["L2", "L3"]);
    expect(p.medicinesXof).toBe(2500);
  });
  it("adds the night surcharge between 22:00 and 07:00 Dakar", () => {
    expect(priceOrder(lines, chosen, 1000, new Date("2026-10-08T23:30:00Z"), S).feeXof).toBe(roundUp(1000 + 390 + 1000, 100));
  });
});

describe("isNight", () => {
  it("handles windows that cross midnight", () => {
    expect(isNight(new Date("2026-10-08T22:00:00Z"), 22, 7)).toBe(true);
    expect(isNight(new Date("2026-10-08T06:59:00Z"), 22, 7)).toBe(true);
    expect(isNight(new Date("2026-10-08T07:00:00Z"), 22, 7)).toBe(false);
    expect(isNight(new Date("2026-10-08T13:00:00Z"), 12, 14)).toBe(true);
  });
});
