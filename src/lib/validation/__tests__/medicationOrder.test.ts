import { describe, expect, it } from "vitest";
import { medicationOrderSchema } from "../medicationOrder";

const ID = "11111111-1111-4111-8111-111111111111";
const base = {
  patientId: ID,
  lines: [{ medicationId: ID, quantity: 2 }, { freeText: "Vitamine D 1000 UI", quantity: 1 }],
  documents: [{ requirementCode: "PRESCRIPTION_PHOTO", fileId: ID }],
  acknowledged: [],
  when: "TODAY",
  deliveryAddress: "Sacré-Cœur 3, villa 12",
  contactPhone: "77 123 45 67",
  contactHasWhatsapp: true,
};
const codes = (o: object) => {
  const r = medicationOrderSchema.safeParse(o);
  return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`);
};

describe("medicationOrderSchema", () => {
  it("accepts catalog and free-text items with documents", () => {
    expect(codes(base)).toEqual([]);
  });
  it("needs at least one item, and sensible quantities", () => {
    expect(codes({ ...base, lines: [] })).toEqual(["lines:noItems"]);
    expect(codes({ ...base, lines: [{ medicationId: ID, quantity: 0 }] })).toEqual(["lines:quantity"]);
    expect(codes({ ...base, lines: [{ medicationId: ID, quantity: 21 }] })).toEqual(["lines:quantity"]);
  });
  it("needs an address and when", () => {
    expect(codes({ ...base, deliveryAddress: "ici", when: undefined })).toEqual(expect.arrayContaining(["deliveryAddress:address", "when:when"]));
  });
  it("location needs both coordinates", () => {
    expect(codes({ ...base, latitude: 14.7 })).toEqual(["latitude:location"]);
    expect(codes({ ...base, latitude: 14.7, longitude: -17.4 })).toEqual([]);
  });
});
