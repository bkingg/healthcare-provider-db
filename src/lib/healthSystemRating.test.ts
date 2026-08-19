import { describe, expect, it } from "vitest";
import { healthSystemRatingClasses } from "./healthSystemRating";

describe("healthSystemRatingClasses", () => {
  it("gives each level its own color", () => {
    const classes = [5, 4, 3, 2, 1].map(healthSystemRatingClasses);
    expect(new Set(classes).size).toBe(5);
    expect(healthSystemRatingClasses(5)).toContain("#14532d"); // dark green
    expect(healthSystemRatingClasses(4)).toContain("#86efac"); // light green
    expect(healthSystemRatingClasses(3)).toContain("#fde047"); // yellow
    expect(healthSystemRatingClasses(2)).toContain("#fdba74"); // orange
    expect(healthSystemRatingClasses(1)).toContain("#dc2626"); // red
  });

  it("leaves unrated uncolored", () => {
    expect(healthSystemRatingClasses(null)).not.toMatch(/bg-\[/);
    expect(healthSystemRatingClasses(undefined)).toBe(healthSystemRatingClasses(null));
  });

  it("rounds in-between values to the nearest level", () => {
    expect(healthSystemRatingClasses(4.2)).toBe(healthSystemRatingClasses(4));
  });
});
