import { describe, expect, it } from "vitest";
import { actionTiming, parseDueInput, quickDueTimes, toDueInput } from "../caseActions";

const now = new Date("2026-09-27T14:20:00Z");

describe("actionTiming", () => {
  it("is overdue once the time has passed", () => expect(actionTiming(new Date("2026-09-27T14:19:00Z"), now)).toBe("OVERDUE"));
  it("is today until midnight Dakar time", () => expect(actionTiming(new Date("2026-09-27T23:59:00Z"), now)).toBe("TODAY"));
  it("is upcoming from tomorrow", () => expect(actionTiming(new Date("2026-09-28T00:00:00Z"), now)).toBe("UPCOMING"));
});

describe("due input", () => {
  it("reads a datetime-local value as Dakar (UTC) time and writes it back", () => {
    const d = parseDueInput("2026-09-27T15:00");
    expect(d?.toISOString()).toBe("2026-09-27T15:00:00.000Z");
    expect(toDueInput(d!)).toBe("2026-09-27T15:00");
  });
  it("rejects anything else", () => {
    expect(parseDueInput("tomorrow")).toBeNull();
    expect(parseDueInput("2026-13-45T99:00")).toBeNull();
  });
});

describe("quickDueTimes", () => {
  it("offers in 1 hour (rounded to 5 min), today 17:00 and tomorrow 09:00", () => {
    expect(quickDueTimes(now).map((q) => [q.key, q.at.toISOString()])).toEqual([
      ["inOneHour", "2026-09-27T15:20:00.000Z"],
      ["today17", "2026-09-27T17:00:00.000Z"],
      ["tomorrow9", "2026-09-28T09:00:00.000Z"],
    ]);
  });
  it("drops today 17:00 late in the day", () => {
    expect(quickDueTimes(new Date("2026-09-27T16:30:00Z")).map((q) => q.key)).toEqual(["inOneHour", "tomorrow9"]);
  });
});
