import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkerPin, PIN_HEIGHT, PIN_WIDTH } from "@/components/map-marker-pin";
import type { MarkerStyle } from "@/lib/mapMarkerStyle";

const iconCache = new Map<string, L.DivIcon>();

/** Builds (and caches) the Leaflet icon for a provider's marker style —
 * the pin from MarkerPin, with its tip on the provider's exact location.
 * Styles come from the provider type's admin-set icon/color (see
 * resolveMarkerStyle), so they're cached per icon+color pair rather than
 * per type code. */
export function getMarkerIcon(style: MarkerStyle): L.DivIcon {
  const key = `${style.icon}|${style.color}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "pn-marker",
    html: renderToStaticMarkup(<MarkerPin style={style} />),
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT - 1.5],
    popupAnchor: [0, -PIN_HEIGHT + 4],
  });
  iconCache.set(key, icon);
  return icon;
}

/** Cluster bubble in the app's own style — solid ink with a white count
 * and ring — replacing the marker-cluster plugin's default translucent
 * green/yellow/orange, which read as map areas (parks, fields) rather than
 * grouped database records. Grows a little with the count. */
export function getClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 34 : count < 100 ? 40 : 46;
  return L.divIcon({
    className: "pn-cluster",
    html:
      `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;` +
      `border-radius:50%;background:#14201a;color:#fff;border:3px solid #fff;` +
      `box-shadow:0 0 0 2px #14201a,0 2px 4px rgba(20,32,26,0.4);font:700 13px/1 var(--font-archivo),system-ui,sans-serif">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

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
