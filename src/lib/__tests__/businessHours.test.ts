import { describe, expect, it } from "vitest";
import { isOfficeHours, responseDueAt } from "@/lib/businessHours";

// 2026-09-25 is a Friday; Dakar = UTC.
const at = (iso: string) => new Date(`${iso}Z`);

describe("isOfficeHours", () => {
  it("is true Monday–Friday 09:00–17:00 Dakar time", () => {
    expect(isOfficeHours(at("2026-09-25T09:00:00"))).toBe(true);
    expect(isOfficeHours(at("2026-09-25T16:59:00"))).toBe(true);
    expect(isOfficeHours(at("2026-09-25T17:00:00"))).toBe(false);
    expect(isOfficeHours(at("2026-09-25T08:59:00"))).toBe(false);
    expect(isOfficeHours(at("2026-09-26T11:00:00"))).toBe(false); // Saturday
  });
});

describe("responseDueAt", () => {
  it("runs on the 24/7 clock for red (on-call)", () => {
    expect(responseDueAt(at("2026-09-26T23:50:00"), 15, false)).toEqual(at("2026-09-27T00:05:00"));
  });
  it("counts office-hours minutes only, carrying over the weekend", () => {
    expect(responseDueAt(at("2026-09-25T10:00:00"), 120, true)).toEqual(at("2026-09-25T12:00:00"));
    expect(responseDueAt(at("2026-09-25T16:30:00"), 120, true)).toEqual(at("2026-09-28T10:30:00")); // Fri → Mon
  });
  it("starts counting at opening time when a case arrives out of hours", () => {
    expect(responseDueAt(at("2026-09-24T20:00:00"), 120, true)).toEqual(at("2026-09-25T11:00:00")); // Thu night → Fri
    expect(responseDueAt(at("2026-09-26T10:00:00"), 480, true)).toEqual(at("2026-09-28T17:00:00")); // Sat → end of Mon
  });
  it("gives green's one working day as the same time the next working day", () => {
    expect(responseDueAt(at("2026-09-24T14:00:00"), 480, true)).toEqual(at("2026-09-25T14:00:00")); // Thu → Fri
  });
});
