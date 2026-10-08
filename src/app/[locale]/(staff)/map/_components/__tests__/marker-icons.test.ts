import { describe, expect, it } from "vitest";
import { getClusterIcon, getMarkerIcon, getSearchPointIcon, searchPointHeight } from "../marker-icons";
import { DEFAULT_TYPE_MARKER_STYLES, FALLBACK_MARKER_STYLE, resolveMarkerStyle } from "@/lib/mapMarkerStyle";

describe("getMarkerIcon", () => {
  it("builds a pin for every built-in type style, each one distinct", () => {
    const html = Object.values(DEFAULT_TYPE_MARKER_STYLES).map((style) => getMarkerIcon(style).options.html);
    expect(new Set(html).size).toBe(Object.keys(DEFAULT_TYPE_MARKER_STYLES).length);
  });

  it("fills the pin with the style's color and puts its tip on the location", () => {
    const icon = getMarkerIcon({ icon: "hospital", color: "#7c3aed" });
    expect(icon.options.html).toContain('fill="#7c3aed"');
    expect(icon.options.iconSize).toEqual([30, 40]);
    // Tip of the teardrop, centred horizontally at the bottom.
    expect(icon.options.iconAnchor).toEqual([15, 38.5]);
  });

  it("renders an admin-chosen style for a type the app has no default for", () => {
    const style = resolveMarkerStyle({ code: "DENTAL", mapIcon: "smile", mapColor: "#be185d" });
    expect(getMarkerIcon(style).options.html).toContain('fill="#be185d"');
    expect(() => getMarkerIcon(FALLBACK_MARKER_STYLE)).not.toThrow();
  });

  it("caches the icon instance per icon+color", () => {
    expect(getMarkerIcon({ icon: "pill", color: "#ea580c" })).toBe(getMarkerIcon({ icon: "pill", color: "#ea580c" }));
  });
});

describe("getClusterIcon", () => {
  it("shows the count and grows with it", () => {
    expect(getClusterIcon(7).options.html).toContain(">7<");
    const small = getClusterIcon(5).options.iconSize as [number, number];
    const large = getClusterIcon(250).options.iconSize as [number, number];
    expect(large[0]).toBeGreaterThan(small[0]);
  });
});

describe("searchPointHeight", () => {
  it("grows as the map zooms in", () => {
    expect(searchPointHeight(8)).toBeLessThan(searchPointHeight(11));
    expect(searchPointHeight(11)).toBeLessThan(searchPointHeight(15));
  });

  it("stays within 34–60px at any zoom", () => {
    expect(searchPointHeight(0)).toBe(34);
    expect(searchPointHeight(22)).toBe(60);
  });
});

describe("getSearchPointIcon", () => {
  it("anchors the figure's feet on the point and sizes it to the requested height", () => {
    const icon = getSearchPointIcon(32);
    expect(icon.options.iconSize).toEqual([16, 32]);
    expect(icon.options.iconAnchor).toEqual([8, 32]);
    expect(icon.options.html).toContain("#dc2626");
  });

  it("reuses the icon for the same height", () => {
    expect(getSearchPointIcon(30)).toBe(getSearchPointIcon(30));
  });
});

describe("getMarkerIcon for DO_NOT_USE providers", () => {
  it("caches flagged and unflagged pins separately", () => {
    const style = { icon: "building", color: "#1d4ed8" } as const;
    expect(getMarkerIcon(style, true)).not.toBe(getMarkerIcon(style, false));
    expect(getMarkerIcon(style, true).options.html).toContain("#dc2626");
  });
});
