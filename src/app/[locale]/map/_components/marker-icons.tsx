import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Building2, HeartPulse, Hospital, MapPin, Microscope, Pill, Stethoscope } from "lucide-react";
import type { ComponentType } from "react";

/** One icon per current `ProviderTypeRef` leaf code (see the 6 TYPE-level
 * rows seeded in this app — HOSPITAL/PHYSICIAN/CLINIC/PHARMACY/HEALTH_CENTER/
 * DIAGNOSTIC_CENTER). Any future/unknown code falls back to a generic pin
 * rather than throwing, since this is keyed off free-form reference data a
 * steward can add to. */
const PROVIDER_TYPE_ICON_COMPONENT: Record<string, ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
  HOSPITAL: Hospital,
  PHYSICIAN: Stethoscope,
  CLINIC: Building2,
  PHARMACY: Pill,
  HEALTH_CENTER: HeartPulse,
  DIAGNOSTIC_CENTER: Microscope,
};
const DEFAULT_ICON_COMPONENT = MapPin;

/** Distinct border colors per type so clustered/zoomed-out markers are still
 * visually distinguishable at a glance, on top of the icon shape itself. */
const PROVIDER_TYPE_COLOR: Record<string, string> = {
  HOSPITAL: "#0e8455",
  PHYSICIAN: "#8b5cf6",
  CLINIC: "#2563eb",
  PHARMACY: "#d97706",
  HEALTH_CENTER: "#dc2626",
  DIAGNOSTIC_CENTER: "#0891b2",
};
const DEFAULT_COLOR = "#52625a";

const iconCache = new Map<string, L.DivIcon>();

/** Builds (and caches) the small type-specific marker icon for a
 * `ProviderTypeRef.code`. Cached per code since the same handful of icons
 * are reused across every marker on the map. */
export function getMarkerIcon(typeCode: string | undefined): L.DivIcon {
  const key = typeCode ?? "__default__";
  const cached = iconCache.get(key);
  if (cached) return cached;

  const Icon = (typeCode && PROVIDER_TYPE_ICON_COMPONENT[typeCode]) || DEFAULT_ICON_COMPONENT;
  const color = (typeCode && PROVIDER_TYPE_COLOR[typeCode]) || DEFAULT_COLOR;
  const svg = renderToStaticMarkup(<Icon size={14} strokeWidth={2.5} color="#14201a" />);

  const icon = L.divIcon({
    className: "pn-marker",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:#fff;border:2px solid ${color};border-radius:50%;box-shadow:0 1px 2px rgba(20,32,26,0.3);">${svg}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
  iconCache.set(key, icon);
  return icon;
}

/** Small colored dot used in the marker-cluster's own icon (see
 * provider-map.tsx) and anywhere else a compact type legend swatch is
 * useful, without pulling in a full marker. */
export function getProviderTypeColor(typeCode: string | undefined): string {
  return (typeCode && PROVIDER_TYPE_COLOR[typeCode]) || DEFAULT_COLOR;
}

export { PROVIDER_TYPE_ICON_COMPONENT, DEFAULT_ICON_COMPONENT };

const SEARCH_POINT_MIN_HEIGHT = 20;
const SEARCH_POINT_MAX_HEIGHT = 56;

/** Height (px) of the distance-search "person" marker at a given map zoom:
 * grows as the user zooms in and shrinks as they zoom out — 20px at a
 * country-wide view, ~35px at city level (zoom 11), up to 56px at street
 * level — so it reads as a figure on the ground rather than a fixed-size
 * overlay. Whole pixels, so the icon cache below stays small. */
export function searchPointHeight(zoom: number): number {
  return Math.round(Math.min(SEARCH_POINT_MAX_HEIGHT, Math.max(SEARCH_POINT_MIN_HEIGHT, 4 + 2.8 * zoom)));
}

const searchPointIconCache = new Map<number, L.DivIcon>();

/** Red standing figure (head, arms, legs) marking a distance-from-point search's
 * point of interest, anchored at its feet (bottom center) so it stands on
 * the exact search point like a map pin. White outline + shadow keep it
 * legible over any tile colour. Cached per height. */
export function getSearchPointIcon(height: number): L.DivIcon {
  const cached = searchPointIconCache.get(height);
  if (cached) return cached;

  const width = Math.round(height / 2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 40" width="${width}" height="${height}" ` +
    `style="display:block;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(20,32,26,0.45))">` +
    `<g fill="#dc2626" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round">` +
    `<circle cx="10" cy="5.2" r="4.3"/>` +
    // Torso with both arms down, then two legs.
    `<path d="M5.5 11H14.5A2.5 2.5 0 0 1 17 13.5V23A1.5 1.5 0 0 1 14 23V16H13.5V37A1.55 1.55 0 0 1 10.4 37V26H9.6V37A1.55 1.55 0 0 1 6.5 37V16H6V23A1.5 1.5 0 0 1 3 23V13.5A2.5 2.5 0 0 1 5.5 11Z"/>` +
    `</g></svg>`;

  const icon = L.divIcon({
    className: "pn-search-point",
    html: svg,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    tooltipAnchor: [0, -height],
  });
  searchPointIconCache.set(height, icon);
  return icon;
}
