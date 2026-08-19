import { describe, expect, it } from "vitest";
import { formatProviderRating, providerRatingSortValue } from "./providerRating";

describe("formatProviderRating", () => {
  it("shows both ratings", () => expect(formatProviderRating(4, 3)).toBe("Q 4 · A 3"));
  it("shows only the one that is set", () => {
    expect(formatProviderRating(5, null)).toBe("Q 5");
    expect(formatProviderRating(null, 2)).toBe("A 2");
  });
  it("is null when neither is set", () => expect(formatProviderRating(null, null)).toBeNull());
});

describe("providerRatingSortValue", () => {
  it("adds the ratings, treating a missing one as 0", () => {
    expect(providerRatingSortValue(4, 3)).toBe(7);
    expect(providerRatingSortValue(null, 2)).toBe(2);
  });
  it("is null when nothing is rated", () => expect(providerRatingSortValue(null, null)).toBeNull());
});
