import { describe, expect, it } from "vitest";
import { ageFromDateOfBirth, formatMemberNumber, parseMemberNumber } from "@/lib/memberNumber";

describe("member numbers", () => {
  it("formats as MBR-000123", () => {
    expect(formatMemberNumber(123)).toBe("MBR-000123");
    expect(formatMemberNumber(1234567)).toBe("MBR-1234567");
  });

  it("parses the forms staff are likely to type", () => {
    for (const input of ["MBR-000123", "mbr-123", "MBR123", "000123", "123", " MBR-000123 "]) expect(parseMemberNumber(input)).toBe(123);
    for (const input of ["NMD-000123", "abc", "", "MBR-"]) expect(parseMemberNumber(input)).toBeNull();
  });
});

describe("ageFromDateOfBirth", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  it("counts whole years, not yet a year older before the birthday", () => {
    expect(ageFromDateOfBirth(new Date("1986-04-12"), now)).toBe(40);
    expect(ageFromDateOfBirth(new Date("2015-09-26"), now)).toBe(10);
    expect(ageFromDateOfBirth(new Date("2015-09-25"), now)).toBe(11);
  });
  it("is null without a date of birth", () => {
    expect(ageFromDateOfBirth(null, now)).toBeNull();
  });
});
