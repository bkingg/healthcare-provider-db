import { describe, expect, it } from "vitest";
import { isOpenAt } from "../openNow";

const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const monSat = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map((d) => ({ dayOfWeek: d, openTime: t("08:00"), closeTime: t("22:00") }));
// 2026-10-05 is a Monday; 2026-10-04 a Sunday.
const at = (iso: string) => new Date(`${iso}Z`);

describe("isOpenAt", () => {
  it("24/7 is always open", () => {
    expect(isOpenAt({ isOpen24_7: true, officeHours: [] }, at("2026-10-04T03:00:00"))).toBe(true);
  });
  it("follows the day's posted hours", () => {
    const p = { isOpen24_7: false, officeHours: monSat };
    expect(isOpenAt(p, at("2026-10-05T08:00:00"))).toBe(true);
    expect(isOpenAt(p, at("2026-10-05T21:59:00"))).toBe(true);
    expect(isOpenAt(p, at("2026-10-05T22:00:00"))).toBe(false);
    expect(isOpenAt(p, at("2026-10-04T12:00:00"))).toBe(false);
  });
  it("handles hours running past midnight", () => {
    const p = { isOpen24_7: false, officeHours: [{ dayOfWeek: "FRIDAY", openTime: t("20:00"), closeTime: t("02:00") }] };
    expect(isOpenAt(p, at("2026-10-09T23:30:00"))).toBe(true);
    expect(isOpenAt(p, at("2026-10-10T01:30:00"))).toBe(true);
    expect(isOpenAt(p, at("2026-10-10T02:30:00"))).toBe(false);
  });
  it("no hours and not 24/7 means not known to be open", () => {
    expect(isOpenAt({ isOpen24_7: false, officeHours: [] }, at("2026-10-05T10:00:00"))).toBe(false);
  });
});
