import { describe, expect, it } from "vitest";
import { formatProviderNumber, parseProviderNumber } from "../providerNumber";

describe("formatProviderNumber", () => {
  it("pads to six digits with the NMD prefix", () => {
    expect(formatProviderNumber(12)).toBe("NMD-000012");
  });
});

describe("parseProviderNumber", () => {
  it("reads NMD IDs however they're typed", () => {
    expect(parseProviderNumber("NMD-000012")).toBe(12);
    expect(parseProviderNumber("nmd12")).toBe(12);
    expect(parseProviderNumber(" NMD 12 ")).toBe(12);
  });
  it("accepts a bare number only when asked to", () => {
    expect(parseProviderNumber("12")).toBeNull();
    expect(parseProviderNumber("000012", { allowBare: true })).toBe(12);
  });
  it("rejects anything else", () => {
    expect(parseProviderNumber("MBR-000012")).toBeNull();
    expect(parseProviderNumber("NMD-0")).toBeNull();
    expect(parseProviderNumber("clinic 12", { allowBare: true })).toBeNull();
  });
});
