import { describe, expect, it } from "vitest";
import { parseSearchParams } from "./validation/search";
import { toggleParamHref } from "./searchParamsHref";

const statusesIn = (href: string) => new URL(href, "http://x").searchParams.getAll("statuses");

describe("status filter default", () => {
  it("defaults to Active when the URL has no statuses", () => {
    expect(parseSearchParams({}).statuses).toEqual(["ACTIVE"]);
    expect(parseSearchParams({ q: "clinic" }).statuses).toEqual(["ACTIVE"]);
  });

  it("uses the statuses in the URL when present", () => {
    expect(parseSearchParams({ statuses: ["INACTIVE", "SUSPENDED"] }).statuses).toEqual(["INACTIVE", "SUSPENDED"]);
  });

  it("treats an empty statuses= as any status", () => {
    expect(parseSearchParams({ statuses: "" }).statuses).toEqual([]);
  });
});

describe("toggling a status pill", () => {
  it("switching off the default Active writes an empty statuses (any status)", () => {
    const href = toggleParamHref("/providers", {}, "statuses", "ACTIVE");
    expect(statusesIn(href)).toEqual([""]);
    expect(parseSearchParams(Object.fromEntries(new URL(href, "http://x").searchParams)).statuses).toEqual([]);
  });

  it("adding another status keeps the implied Active", () => {
    expect(statusesIn(toggleParamHref("/providers", {}, "statuses", "INACTIVE")).sort()).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("switching on a status from the any-status state selects just that one", () => {
    expect(statusesIn(toggleParamHref("/providers", { statuses: "" }, "statuses", "ACTIVE"))).toEqual(["ACTIVE"]);
  });

  it("switching off the last explicit status goes back to any status, not the default", () => {
    expect(statusesIn(toggleParamHref("/providers", { statuses: ["INACTIVE"] }, "statuses", "INACTIVE"))).toEqual([""]);
  });

  it("leaves other params alone and still toggles ordinary filters", () => {
    const href = toggleParamHref("/providers", { q: "x", countryIds: "a" }, "countryIds", "b");
    const p = new URL(href, "http://x").searchParams;
    expect(p.get("q")).toBe("x");
    expect(p.getAll("countryIds")).toEqual(["a", "b"]);
  });
});
