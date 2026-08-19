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
