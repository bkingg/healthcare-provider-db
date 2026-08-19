import { describe, expect, it } from "vitest";
import { mapExportHref } from "./searchParamsHref";

describe("mapExportHref", () => {
  it("carries every filter over to the map, including repeated ones", () => {
    const href = mapExportHref({ q: "clinic", countryIds: ["a", "b"], sort: "name" });
    const params = new URL(href, "http://x").searchParams;
    expect(href.startsWith("/map?")).toBe(true);
    expect(params.get("q")).toBe("clinic");
    expect(params.getAll("countryIds")).toEqual(["a", "b"]);
    expect(params.get("sort")).toBe("name");
  });

  it("drops the list's pagination position and page size", () => {
    const href = mapExportHref({ q: "x", cursors: "abc|def", pageSize: "50" });
    expect(href).toBe("/map?q=x");
  });

  it("is just /map when there is no search", () => {
    expect(mapExportHref({})).toBe("/map");
  });
});
