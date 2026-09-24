import { describe, expect, it } from "vitest";
import { referenceItemSchema } from "@/lib/validation/referenceLists";

const base = { code: "HOSPITAL", nameEn: "Hospital", level: "TYPE" };

describe("provider type map marker validation", () => {
  const schema = referenceItemSchema("providerTypes");

  it("accepts a known icon and a hex color, normalising the color to lowercase", () => {
    const r = schema.safeParse({ ...base, mapIcon: "ambulance", mapColor: "#DB2777" });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ mapIcon: "ambulance", mapColor: "#db2777" });
  });

  it("stores empty choices as null, so saving 'Default' clears an override", () => {
    const r = schema.safeParse({ ...base, mapIcon: "", mapColor: "" });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ mapIcon: null, mapColor: null });
  });

  it("rejects icons outside the allowed set and malformed colors", () => {
    expect(schema.safeParse({ ...base, mapIcon: "rocket" }).success).toBe(false);
    expect(schema.safeParse({ ...base, mapColor: "red" }).success).toBe(false);
    expect(schema.safeParse({ ...base, mapColor: "#fff" }).success).toBe(false);
  });
});
