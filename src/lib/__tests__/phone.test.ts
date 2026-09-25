import { describe, expect, it } from "vitest";
import { countryCallingCode, formatPhoneInput, normalizeCallbackPhone, phoneCountries, reformatForCountry } from "@/lib/phone";

describe("countryCallingCode", () => {
  it("returns the dial code for a supported country", () => {
    expect(countryCallingCode("SN")).toBe("+221");
    expect(countryCallingCode("US")).toBe("+1");
  });

  it("returns undefined for a code libphonenumber-js doesn't recognize", () => {
    expect(countryCallingCode("ZZ")).toBeUndefined();
  });
});

describe("formatPhoneInput", () => {
  it("formats digits into the country's standard international grouping", () => {
    expect(formatPhoneInput("771234567", "SN")).toBe("+221 77 123 45 67");
    expect(formatPhoneInput("2133734253", "US")).toBe("+1 213 373 4253");
    expect(formatPhoneInput("7911123456", "GB")).toBe("+44 7911 123456");
    expect(formatPhoneInput("612345678", "FR")).toBe("+33 6 12 34 56 78");
    expect(formatPhoneInput("8021234567", "NG")).toBe("+234 802 123 4567");
  });

  it("re-derives the national digits instead of doubling the dial code on repeat keystrokes", () => {
    // Simulates onChange firing again on a value the function already formatted.
    expect(formatPhoneInput("+221 77 123 45 67", "SN")).toBe("+221 77 123 45 67");
  });

  it("truncates to the country's standard length instead of growing unbounded", () => {
    expect(formatPhoneInput("7712345679999999", "SN")).toBe("+221 77 123 45 67");
  });

  it("returns the input unchanged for a country with no known metadata", () => {
    expect(formatPhoneInput("12345", "ZZ")).toBe("12345");
  });
});

describe("reformatForCountry", () => {
  it("drops the old country's dial code instead of carrying it into the new country's number", () => {
    // Just the prefilled "+221 " with nothing typed yet — switching to the US
    // should leave an empty national number, not read Senegal's "221" as if
    // it were a US area code.
    expect(reformatForCountry("+221 ", "SN", "US")).toBe("+1 ");
  });

  it("carries over genuinely typed national digits when switching country", () => {
    expect(reformatForCountry("+221 77 123 45 67", "SN", "US")).toBe("+1 771 234 567");
  });

  it("truncates the carried-over digits to the new country's standard length", () => {
    expect(reformatForCountry("+234 802 123 4567", "NG", "FR")).toBe("+33 802 12 34 56");
  });
});

describe("phoneCountries", () => {
  it("includes Senegal with its name and calling code, sorted by name", () => {
    const countries = phoneCountries();
    expect(countries).toContainEqual({ iso2: "SN", name: "Senegal", callingCode: "221" });
    const names = countries.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("normalizeCallbackPhone", () => {
  it("formats Senegalese numbers typed without a country code", () => {
    expect(normalizeCallbackPhone("77 123 45 67")).toBe("+221 77 123 45 67");
    expect(normalizeCallbackPhone("771234567")).toBe("+221 77 123 45 67");
    expect(normalizeCallbackPhone("76 773 2001")).toBe("+221 76 773 20 01");
  });
  it("keeps numbers that already have a country code, including 00-prefixed", () => {
    expect(normalizeCallbackPhone("+221771234567")).toBe("+221 77 123 45 67");
    expect(normalizeCallbackPhone("0033 6 12 34 56 78")).toBe("+33 6 12 34 56 78");
  });
  it("reads numbers without a code in the member's own country", () => {
    expect(normalizeCallbackPhone("06 12 34 56 78", "FR")).toBe("+33 6 12 34 56 78");
  });
  it("rejects things that aren't phone numbers", () => {
    for (const bad of ["", "   ", "12", "hello", "77 12"]) expect(normalizeCallbackPhone(bad)).toBeNull();
  });
});
