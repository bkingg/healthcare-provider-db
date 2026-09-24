/** Map marker style for a provider type — which icon and pin color its
 * providers get on the geospatial search map. Admins set both per type in
 * Admin > Value lists > Provider types (ProviderTypeRef.mapIcon/mapColor);
 * a type with neither set falls back to the built-in default for its code
 * below, then to a generic pin. Plain data only (no React/Leaflet), so the
 * server-side validation, the admin UI and the map all share it. */

/** Icons an admin can pick for a type. Keys are stored in the database, so
 * existing keys must never be renamed or removed — only added. */
export const MAP_ICON_KEYS = [
  "hospital",
  "stethoscope",
  "building",
  "pill",
  "heart-pulse",
  "microscope",
  "ambulance",
  "baby",
  "bone",
  "brain",
  "eye",
  "ear",
  "smile",
  "syringe",
  "test-tube",
  "dna",
  "activity",
  "cross",
  "briefcase-medical",
  "hand-heart",
  "accessibility",
  "house",
  "map-pin",
] as const;

export type MapIconKey = (typeof MAP_ICON_KEYS)[number];

export function isMapIconKey(v: unknown): v is MapIconKey {
  return typeof v === "string" && (MAP_ICON_KEYS as readonly string[]).includes(v);
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX_COLOR.test(v);
}

/** Strong, saturated colors offered as one-click choices in the admin color
 * picker. Chosen to stand apart from OpenStreetMap's own palette (soft
 * greens, light blues, beige, brown) and to leave red for the distance
 * search's point-of-interest marker. */
export const RECOMMENDED_MARKER_COLORS = [
  "#7c3aed", // violet
  "#db2777", // magenta
  "#1d4ed8", // royal blue
  "#ea580c", // orange
  "#0f766e", // dark teal
  "#a16207", // dark gold
  "#4338ca", // indigo
  "#be185d", // raspberry
  "#0369a1", // ocean blue
  "#334155", // slate
] as const;

export type MarkerStyle = { icon: MapIconKey; color: string };

/** Built-in defaults for the provider type codes this app seeds. */
export const DEFAULT_TYPE_MARKER_STYLES: Readonly<Record<string, MarkerStyle>> = {
  HOSPITAL: { icon: "hospital", color: "#7c3aed" },
  PHYSICIAN: { icon: "stethoscope", color: "#db2777" },
  CLINIC: { icon: "building", color: "#1d4ed8" },
  PHARMACY: { icon: "pill", color: "#ea580c" },
  HEALTH_CENTER: { icon: "heart-pulse", color: "#0f766e" },
  DIAGNOSTIC_CENTER: { icon: "microscope", color: "#a16207" },
};

/** For a type with no admin-set style and a code without a built-in default
 * (e.g. a type an admin added). */
export const FALLBACK_MARKER_STYLE: MarkerStyle = { icon: "map-pin", color: "#334155" };

export type MarkerStyleSource = { code?: string | null; mapIcon?: string | null; mapColor?: string | null };

/** The icon and color a type's markers actually use. Each of icon and color
 * falls back independently, so an admin can override just one of them.
 * Invalid stored values (not expected — validation rejects them — but this
 * reads free-form DB text) are treated as unset rather than breaking the map. */
export function resolveMarkerStyle(type: MarkerStyleSource | null | undefined): MarkerStyle {
  const base = (type?.code && DEFAULT_TYPE_MARKER_STYLES[type.code]) || FALLBACK_MARKER_STYLE;
  return {
    icon: isMapIconKey(type?.mapIcon) ? type.mapIcon : base.icon,
    color: isHexColor(type?.mapColor) ? type.mapColor.toLowerCase() : base.color,
  };
}

/** White or near-black, whichever reads better on top of `hex` — so an
 * admin picking a light color (e.g. yellow) still gets a legible icon on
 * the pin. WCAG relative luminance; the 0.4 threshold favours white, which
 * suits the strong colors the palette above recommends. */
export function glyphColorFor(hex: string): "#ffffff" | "#14201a" {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#14201a" : "#ffffff";
}
