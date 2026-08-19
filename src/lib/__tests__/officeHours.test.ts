import { describe, expect, it } from "vitest";
import { formatTimeOfDay } from "@/lib/officeHours";

describe("formatTimeOfDay", () => {
  it("formats a stored time-of-day as a 24-hour clock string", () => {
    expect(formatTimeOfDay(new Date("1970-01-01T16:00:00.000Z"))).toBe("16:00");
    expect(formatTimeOfDay(new Date("1970-01-01T09:00:00.000Z"))).toBe("09:00");
    expect(formatTimeOfDay(new Date("1970-01-01T00:00:00.000Z"))).toBe("00:00");
  });

  it("reads the time in UTC regardless of the host's local timezone", () => {
    // requiredTimeOfDay (validation/common.ts) always builds these with a "Z"
    // suffix — formatting must read them back the same way, or the displayed
    // hour would drift by the server's UTC offset.
    expect(formatTimeOfDay(new Date("1970-01-01T22:30:00.000Z"))).toBe("22:30");
  });
});
