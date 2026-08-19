import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@/lib/validation/search";

describe("parseSearchParams — bbox", () => {
  it("parses a well-formed bounding box into a numeric tuple", () => {
    const filters = parseSearchParams({ bbox: "14.6,-17.5,14.8,-17.3" });
    expect(filters.bbox).toEqual([14.6, -17.5, 14.8, -17.3]);
  });

  it("is undefined when no bbox param is present", () => {
    const filters = parseSearchParams({});
    expect(filters.bbox).toBeUndefined();
  });

  it("falls back to no filters at all when the bbox has too few/many parts", () => {
    const filters = parseSearchParams({ bbox: "14.6,-17.5,14.8", q: "should be dropped too" });
    // Matches this schema's established "fail closed" behavior for any
    // malformed field — parseSearchParams resets every filter, not just the
    // bad one, rather than 500ing on a malformed URL.
    expect(filters.bbox).toBeUndefined();
    expect(filters.q).toBeUndefined();
  });

  it("rejects a box whose min is not less than its max", () => {
    const filters = parseSearchParams({ bbox: "14.8,-17.5,14.6,-17.3" });
    expect(filters.bbox).toBeUndefined();
  });

  it("rejects out-of-range latitude/longitude", () => {
    const filters = parseSearchParams({ bbox: "-95,-17.5,14.8,-17.3" });
    expect(filters.bbox).toBeUndefined();
  });

  it("rejects non-numeric segments", () => {
    const filters = parseSearchParams({ bbox: "north,-17.5,14.8,-17.3" });
    expect(filters.bbox).toBeUndefined();
  });
});

describe("parseSearchParams — needsLocationReview", () => {
  it("defaults to false when absent", () => {
    const filters = parseSearchParams({});
    expect(filters.needsLocationReview).toBe(false);
  });

  it("is true for '1' or 'true'", () => {
    expect(parseSearchParams({ needsLocationReview: "1" }).needsLocationReview).toBe(true);
    expect(parseSearchParams({ needsLocationReview: "true" }).needsLocationReview).toBe(true);
  });

  it("is false for any other value", () => {
    expect(parseSearchParams({ needsLocationReview: "0" }).needsLocationReview).toBe(false);
    expect(parseSearchParams({ needsLocationReview: "false" }).needsLocationReview).toBe(false);
  });
});
