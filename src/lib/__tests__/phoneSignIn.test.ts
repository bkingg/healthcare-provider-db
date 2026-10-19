import { describe, expect, it } from "vitest";
import { allowedCodeCountries, isAdult, maskPhone, normalizeSignInPhone } from "@/lib/phoneSignIn";

describe("normalizeSignInPhone", () => {
  it.each(["77 123 45 67", "771234567", "+221 77 123 45 67", "00221771234567", "+221-77-123-45-67"])("reads %s as a Senegal mobile", (raw) => {
    expect(normalizeSignInPhone(raw, "SN", ["SN"])).toEqual({
      e164: "+221771234567",
      international: "+221 77 123 45 67",
      digitForms: ["221771234567", "771234567"],
      country: "SN",
    });
  });
  it("refuses numbers from countries codes aren't sent to", () => {
    expect(normalizeSignInPhone("+33 6 12 34 56 78", "SN", ["SN"])).toBeNull();
    expect(normalizeSignInPhone("+33 6 12 34 56 78", "SN", ["SN", "FR"])?.e164).toBe("+33612345678");
  });
  it("refuses invalid numbers and Senegal landlines", () => {
    expect(normalizeSignInPhone("12345", "SN", ["SN"])).toBeNull();
    expect(normalizeSignInPhone("33 889 15 15", "SN", ["SN"])).toBeNull();
    expect(normalizeSignInPhone("", "SN", ["SN"])).toBeNull();
  });
});

describe("allowedCodeCountries", () => {
  it("defaults to Senegal and ignores unknown codes", () => {
    expect(allowedCodeCountries(undefined)).toEqual(["SN"]);
    expect(allowedCodeCountries("sn, fr ,XX")).toEqual(["SN", "FR"]);
    expect(allowedCodeCountries("XX")).toEqual(["SN"]);
  });
});

describe("isAdult", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it("is 18 or over on the birthday; unknown counts as adult", () => {
    expect(isAdult(new Date("2008-10-14"), now)).toBe(true);
    expect(isAdult(new Date("2008-10-15"), now)).toBe(false);
    expect(isAdult(null, now)).toBe(true);
  });
});

describe("maskPhone", () => {
  it("hides the middle digits", () => {
    expect(maskPhone("+221 77 123 45 67")).toBe("+221 77 ••• •• 67");
  });
});
