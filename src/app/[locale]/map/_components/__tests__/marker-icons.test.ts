import { describe, expect, it } from "vitest";
import { getMarkerIcon, getProviderTypeColor } from "../marker-icons";

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
