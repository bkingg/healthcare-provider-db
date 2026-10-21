import { describe, expect, it } from "vitest";
import { deliverBy, fillTemplate } from "@/lib/deliveryPromise";

describe("deliverBy", () => {
  const at = (iso: string) => new Date(iso);
  it("urgent: one hour after payment", () => {
    expect(deliverBy("WITHIN_HOUR", at("2026-10-21T13:10:00Z"))?.toISOString()).toBe("2026-10-21T14:10:00.000Z");
  });
  it("today: same day if paid before 20:00, else next day 11:00", () => {
    expect(deliverBy("TODAY", at("2026-10-21T19:59:00Z"))?.toISOString()).toBe("2026-10-21T23:59:00.000Z");
    expect(deliverBy("TODAY", at("2026-10-21T20:00:00Z"))?.toISOString()).toBe("2026-10-22T11:00:00.000Z");
    expect(deliverBy("TODAY", at("2026-10-31T22:30:00Z"))?.toISOString()).toBe("2026-11-01T11:00:00.000Z");
  });
  it("this week: seven days; no rush: no deadline", () => {
    expect(deliverBy("THIS_WEEK", at("2026-10-21T10:00:00Z"))?.toISOString()).toBe("2026-10-28T10:00:00.000Z");
    expect(deliverBy("ROUTINE", at("2026-10-21T10:00:00Z"))).toBeNull();
  });
});

describe("fillTemplate", () => {
  it("fills placeholders and tidies what's left empty", () => {
    expect(fillTemplate("Paid {total}. Thanks! {deliverBy}", { total: "9 500 FCFA", deliverBy: "" })).toBe("Paid 9 500 FCFA. Thanks!");
    expect(fillTemplate("A courier has been booked{eta}.", { eta: " (around 15:40)" })).toBe("A courier has been booked (around 15:40).");
    expect(fillTemplate("A courier has been booked{eta}.", {})).toBe("A courier has been booked.");
  });
  it("keeps French spacing before : and !", () => {
    expect(fillTemplate("Votre prix est prêt : {total}. Merci !", { total: "3 400 FCFA" })).toBe("Votre prix est prêt : 3 400 FCFA. Merci !");
    expect(fillTemplate("Merci ! La pharmacie prépare votre commande. {deliverBy}", { deliverBy: "" })).toBe("Merci ! La pharmacie prépare votre commande.");
  });
});
