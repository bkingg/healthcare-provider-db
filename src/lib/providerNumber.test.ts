import { describe, expect, it } from "vitest";
import { formatProviderNumber } from "./providerNumber";

describe("formatProviderNumber", () => {
  it("zero-pads to six digits with the NMD prefix", () => {
    expect(formatProviderNumber(1)).toBe("NMD-000001");
    expect(formatProviderNumber(123)).toBe("NMD-000123");
  });

  it("keeps growing past six digits instead of truncating", () => {
    expect(formatProviderNumber(1234567)).toBe("NMD-1234567");
  });
});
