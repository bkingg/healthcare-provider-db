import { describe, expect, it } from "vitest";
import { getMarkerIcon, getProviderTypeColor, getSearchPointIcon, searchPointHeight } from "../marker-icons";

const KNOWN_TYPE_CODES = ["HOSPITAL", "PHYSICIAN", "CLINIC", "PHARMACY", "HEALTH_CENTER", "DIAGNOSTIC_CENTER"];

describe("getMarkerIcon", () => {
  it("resolves every known provider type code to an icon without throwing", () => {
    for (const code of KNOWN_TYPE_CODES) {
      expect(() => getMarkerIcon(code)).not.toThrow();
    }
  });

  it("gives each known type a distinct icon", () => {
    const html = KNOWN_TYPE_CODES.map((code) => getMarkerIcon(code).options.html);
    expect(new Set(html).size).toBe(KNOWN_TYPE_CODES.length);
  });

  it("falls back to a default icon for an unknown code, without throwing", () => {
    expect(() => getMarkerIcon("SOME_FUTURE_TYPE")).not.toThrow();
    expect(() => getMarkerIcon(undefined)).not.toThrow();
  });

  it("caches the icon instance per code", () => {
    expect(getMarkerIcon("HOSPITAL")).toBe(getMarkerIcon("HOSPITAL"));
  });
});

describe("getProviderTypeColor", () => {
  it("gives every known type a color and unknown codes a fallback", () => {
    for (const code of KNOWN_TYPE_CODES) {
      expect(getProviderTypeColor(code)).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(getProviderTypeColor("SOME_FUTURE_TYPE")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("searchPointHeight", () => {
  it("grows as the map zooms in", () => {
    expect(searchPointHeight(8)).toBeLessThan(searchPointHeight(11));
    expect(searchPointHeight(11)).toBeLessThan(searchPointHeight(15));
  });

  it("stays within 20–56px at any zoom", () => {
    expect(searchPointHeight(0)).toBe(20);
    expect(searchPointHeight(22)).toBe(56);
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
