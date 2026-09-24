import { describe, expect, it } from "vitest";
import {
  DEFAULT_TYPE_MARKER_STYLES,
  FALLBACK_MARKER_STYLE,
  MAP_ICON_KEYS,
  RECOMMENDED_MARKER_COLORS,
  glyphColorFor,
  isHexColor,
  isMapIconKey,
  resolveMarkerStyle,
} from "@/lib/mapMarkerStyle";

describe("resolveMarkerStyle", () => {
  it("uses the built-in default for a known type code when nothing is set", () => {
    expect(resolveMarkerStyle({ code: "HOSPITAL" })).toEqual(DEFAULT_TYPE_MARKER_STYLES.HOSPITAL);
  });

  it("prefers the admin-set icon and color", () => {
    expect(resolveMarkerStyle({ code: "HOSPITAL", mapIcon: "ambulance", mapColor: "#DB2777" })).toEqual({ icon: "ambulance", color: "#db2777" });
  });

  it("falls back per field, so an admin can override just one", () => {
    expect(resolveMarkerStyle({ code: "CLINIC", mapColor: "#0369a1" })).toEqual({ icon: "building", color: "#0369a1" });
    expect(resolveMarkerStyle({ code: "CLINIC", mapIcon: "baby" })).toEqual({ icon: "baby", color: DEFAULT_TYPE_MARKER_STYLES.CLINIC.color });
  });

  it("uses the generic fallback for unknown codes and missing types, and ignores invalid stored values", () => {
    expect(resolveMarkerStyle({ code: "SOMETHING_NEW" })).toEqual(FALLBACK_MARKER_STYLE);
    expect(resolveMarkerStyle(undefined)).toEqual(FALLBACK_MARKER_STYLE);
    expect(resolveMarkerStyle({ code: "HOSPITAL", mapIcon: "not-an-icon", mapColor: "red" })).toEqual(DEFAULT_TYPE_MARKER_STYLES.HOSPITAL);
  });
});

describe("validation helpers", () => {
  it("accepts only known icon keys", () => {
    expect(isMapIconKey("hospital")).toBe(true);
    expect(isMapIconKey("Hospital")).toBe(false);
    expect(isMapIconKey(undefined)).toBe(false);
  });

  it("accepts only #rrggbb colors", () => {
    expect(isHexColor("#1d4ed8")).toBe(true);
    expect(isHexColor("#1D4ED8")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("blue")).toBe(false);
  });

  it("only uses valid icons and colors in its defaults and recommendations", () => {
    for (const style of [...Object.values(DEFAULT_TYPE_MARKER_STYLES), FALLBACK_MARKER_STYLE]) {
      expect(MAP_ICON_KEYS).toContain(style.icon);
      expect(isHexColor(style.color)).toBe(true);
    }
    for (const c of RECOMMENDED_MARKER_COLORS) expect(isHexColor(c)).toBe(true);
  });

  it("keeps red free for the search-point marker", () => {
    const colors = [...Object.values(DEFAULT_TYPE_MARKER_STYLES).map((s) => s.color), ...RECOMMENDED_MARKER_COLORS];
    expect(colors).not.toContain("#dc2626");
  });
});

describe("glyphColorFor", () => {
  it("puts a white icon on every recommended (strong) color", () => {
    for (const c of RECOMMENDED_MARKER_COLORS) expect(glyphColorFor(c)).toBe("#ffffff");
  });

  it("switches to a dark icon on light colors", () => {
    expect(glyphColorFor("#fde047")).toBe("#14201a");
    expect(glyphColorFor("#ffffff")).toBe("#14201a");
  });
});
