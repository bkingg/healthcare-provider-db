"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type L from "leaflet";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PnTag } from "@/components/pn-tag";
import { DoNotUseFlag } from "@/components/do-not-use-flag";
import { getClusterIcon, getMarkerIcon, getSearchPointIcon, searchPointHeight } from "./marker-icons";
import type { MarkerStyle } from "@/lib/mapMarkerStyle";
import { circleBounds, haversineDistanceKm, HOME_BOUNDS, showHomeArea } from "./geo-math";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export type MapProvider = {
  id: string;
  name: string;
  /** Resolved from the primary provider type (see resolveMarkerStyle). */
  marker: MarkerStyle;
  /** Status DO_NOT_USE — the pin gets a red flag badge. */
  doNotUse: boolean;
  typeName: string;
  status: string;
  ratingLabel?: string;
  lat: number;
  lng: number;
  coordinateStatus: string;
};

// Marker layering, bottom to top: cluster bubbles (plugin default, no
// offset), the search-point figure, individual provider pins.
const SEARCH_POINT_Z = 10000;
const PROVIDER_PIN_Z = 20000;

/** A "Search this area" box: [south, west, north, east]. */
export type AreaBounds = [number, number, number, number];

export type SearchCircle = { lat: number; lng: number; radiusKm: number; label?: string };

/** Fits the map to the current marker set exactly once per distinct id set
 * (a filter change), rather than fighting the user's own pan/zoom on every
 * render — re-fitting on every render would make "Search this area" and the
 * circle tool unusable (the view would snap back as soon as the data
 * refetches).
 *
 * With a distance-from-point search active, the frame also takes in the
 * whole search circle, so the search point stays in view even when no
 * provider falls inside the radius. */
function FitToMarkers({ providers, circle, area }: { providers: MapProvider[]; circle: SearchCircle | null; area: AreaBounds | null }) {
  const map = useMap();
  const idsKey = providers
    .map((p) => p.id)
    .sort()
    .join(",");
  const circleKey = circle ? `${circle.lat},${circle.lng},${circle.radiusKm}` : "";
  const areaKey = area ? area.join(",") : "";

  useEffect(() => {
    // "Search this area": frame the area the user searched (also on reload).
    if (area && !circle) {
      map.fitBounds([
        [area[0], area[1]],
        [area[2], area[3]],
      ]);
      return;
    }
    // No location search: start on Dakar–Rufisque, unless every result is
    // somewhere else (then frame the results, not an empty area).
    if (!circle && showHomeArea(providers)) {
      map.fitBounds(HOME_BOUNDS);
      return;
    }
    const bounds = providers.map((p): [number, number] => [p.lat, p.lng]);
    if (circle) bounds.push(...circleBounds(circle, circle.radiusKm));
    if (bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
      return;
    }
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the *set* of markers (or the search circle) changes, not on every render
  }, [idsKey, circleKey, areaKey]);

  return null;
}

/** The distance search's point of interest: a red person standing on the
 * search point, resized on every zoom change (see searchPointHeight) so it
 * scales with the map like a real landmark would. Layered (zIndexOffset)
 * above cluster bubbles — which covered it completely at zoomed-out views —
 * but beneath individual provider pins (PROVIDER_PIN_Z), so a provider at
 * the exact search point is never hidden; the figure is taller than a pin,
 * so its head still marks the spot. */
function SearchPointMarker({ circle }: { circle: SearchCircle }) {
  const t = useTranslations("Map");
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  return (
    <Marker position={[circle.lat, circle.lng]} icon={getSearchPointIcon(searchPointHeight(zoom))} zIndexOffset={SEARCH_POINT_Z} keyboard={false}>
      <Tooltip direction="top">{circle.label ? t("searchPointNamed", { label: circle.label }) : t("searchPoint")}</Tooltip>
    </Marker>
  );
}

/** "Search this area": shows a floating button once the user pans/zooms away
 * from the bounds the current result set was fetched for. Clicking it hands
 * the new viewport bounds up to the parent, which re-navigates with a `bbox`
 * filter (see buildProviderWhereClause in src/data/search.ts). */
function SearchThisAreaControl({ onSearchArea }: { onSearchArea: (bounds: L.LatLngBounds) => void }) {
  const t = useTranslations("Map");
  const [dirty, setDirty] = useState(false);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

  const map = useMapEvents({
    moveend: () => {
      setDirty(true);
      setBounds(map.getBounds());
    },
  });

  if (!dirty || !bounds) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
      <button
        type="button"
        onClick={() => onSearchArea(bounds)}
        className="pointer-events-auto cursor-pointer border-2 border-pn-ink bg-white px-3 py-1.5 text-xs font-semibold shadow-md hover:bg-pn-surface-hover"
      >
        {t("searchThisArea")}
      </button>
    </div>
  );
}

/** "Circle to find": click once to set the center, click again to set the
 * edge (radius). Computes the radius with the same haversine math used to
 * verify this app's existing distance filter, then hands {center, radiusKm}
 * to the parent — which is the exact same lat/lng/radiusKm filter the
 * sidebar's DistanceFilter already sets, just a second entry point into it. */
function CircleTool({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: (center: { lat: number; lng: number }, radiusKm: number) => void;
}) {
  const t = useTranslations("Map");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [edge, setEdge] = useState<{ lat: number; lng: number } | null>(null);

  useMapEvents({
    click: (e) => {
      if (!active) return;
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!center) {
        setCenter(point);
        return;
      }
      const radiusKm = haversineDistanceKm(center, point);
      onComplete(center, radiusKm);
      setCenter(null);
      setEdge(null);
    },
    mousemove: (e) => {
      if (active && center) setEdge({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!active) return null;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
        <div className="border-2 border-pn-ink bg-white px-3 py-1.5 text-xs font-semibold shadow-md">
          {center ? t("circleToolClickEdge") : t("circleToolClickCenter")}
        </div>
      </div>
      {center && edge && (
        <Circle
          center={[center.lat, center.lng]}
          radius={haversineDistanceKm(center, edge) * 1000}
          pathOptions={{ color: "#0e8455", fillOpacity: 0.08, dashArray: "4 4" }}
        />
      )}
    </>
  );
}

export function ProviderMap({
  providers,
  selectedProviderId,
  onSelectProvider,
  hoveredProviderId,
  onHoverProvider,
  activeCircle,
  area,
  grouped,
  circleToolActive,
  onSearchArea,
  onCircleComplete,
}: {
  providers: MapProvider[];
  selectedProviderId: string | null;
  onSelectProvider: (id: string | null) => void;
  /** Provider under the pointer, here or in the results list. */
  hoveredProviderId: string | null;
  onHoverProvider: (id: string | null) => void;
  activeCircle: SearchCircle | null;
  /** The "Search this area" box currently applied, if any. */
  area: AreaBounds | null;
  /** Group nearby providers into numbered bubbles, or show every pin. */
  grouped: boolean;
  circleToolActive: boolean;
  onSearchArea: (bounds: L.LatLngBounds) => void;
  onCircleComplete: (center: { lat: number; lng: number }, radiusKm: number) => void;
}) {
  const t = useTranslations("Map");
  const markerRefs = useRef(new Map<string, L.Marker>());
  // Only getVisibleParent is needed (the cluster plugin's types aren't installed).
  const clusterRef = useRef<{ getVisibleParent(marker: L.Marker): L.Marker | null }>(null);

  useEffect(() => {
    if (!selectedProviderId) return;
    markerRefs.current.get(selectedProviderId)?.openPopup();
  }, [selectedProviderId]);

  // Pops the hovered provider's pin up above the others — or, when it's
  // grouped into a bubble, the bubble holding it.
  useEffect(() => {
    const marker = hoveredProviderId ? markerRefs.current.get(hoveredProviderId) : undefined;
    if (!marker) return;
    const shown = (grouped && clusterRef.current?.getVisibleParent(marker)) || marker;
    const el = shown.getElement();
    el?.classList.add("pn-hover");
    shown.setZIndexOffset(PROVIDER_PIN_Z + 1000);
    return () => {
      el?.classList.remove("pn-hover");
      shown.setZIndexOffset(shown === marker ? PROVIDER_PIN_Z : 0);
    };
  }, [hoveredProviderId, grouped]);

  // Opens on the Dakar–Rufisque area; FitToMarkers then frames any location
  // search, or the results if none of them is in that area.
  const initialCenter = useMemo<[number, number]>(
    () => [(HOME_BOUNDS[0][0] + HOME_BOUNDS[1][0]) / 2, (HOME_BOUNDS[0][1] + HOME_BOUNDS[1][1]) / 2],
    [],
  );

  const markers = providers.map((p) => (
    <Marker
      key={p.id}
      position={[p.lat, p.lng]}
      icon={getMarkerIcon(p.marker, p.doNotUse)}
      zIndexOffset={PROVIDER_PIN_Z}
      ref={(ref) => {
        if (ref) markerRefs.current.set(p.id, ref);
        else markerRefs.current.delete(p.id);
      }}
      eventHandlers={{
        click: () => onSelectProvider(p.id),
        mouseover: () => onHoverProvider(p.id),
        mouseout: () => onHoverProvider(null),
      }}
    >
      <Popup>
        <div className="flex min-w-[180px] flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-pn-ink">
            <DoNotUseFlag status={p.status} />
            {p.name}
          </div>
          {p.doNotUse && (
            <div>
              <PnTag status={p.status} />
            </div>
          )}
          <div className="text-xs text-pn-gray-2">{p.typeName}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-pn-gray-2">{t("popupRating")}:</span>
            <span className="text-xs font-semibold">{p.ratingLabel ?? "—"}</span>
          </div>
          {p.coordinateStatus !== "CONFIRMED" && (
            <div>
              <PnTag status={p.coordinateStatus} />
            </div>
          )}
          <Link href={`/providers/${p.id}`} className="mt-1 text-xs font-semibold text-[#0a5c3c] hover:underline">
            {t("popupViewRecord")} →
          </Link>
        </div>
      </Popup>
    </Marker>
  ));

  return (
    <div className="relative h-full w-full">
      <MapContainer center={initialCenter} zoom={12} className="h-full w-full" scrollWheelZoom>
        {/* Required OpenStreetMap attribution — always visible, per OSM's
         * license terms, not just noted in a footer. */}
        {/* Base map toned down (40% less saturated) so everything drawn from
         * the database — provider pins, clusters, the search circle and
         * point — stands out from OpenStreetMap's own colours. */}
        <TileLayer
          className="saturate-[.6]"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        />
        <FitToMarkers providers={providers} circle={activeCircle} area={area} />
        <SearchThisAreaControl onSearchArea={onSearchArea} />
        {/* Keyed on active: remounts on toggle so center/edge reset cleanly
         * without a setState-in-effect (React flags that as a footgun —
         * this achieves the same "reset on prop change" via a fresh mount
         * instead). */}
        <CircleTool key={circleToolActive ? "on" : "off"} active={circleToolActive} onComplete={onCircleComplete} />
        {activeCircle && (
          <Circle
            center={[activeCircle.lat, activeCircle.lng]}
            radius={activeCircle.radiusKm * 1000}
            pathOptions={{ color: "#0e8455", fillOpacity: 0.06 }}
          />
        )}
        {activeCircle && <SearchPointMarker circle={activeCircle} />}
        {grouped ? (
          <MarkerClusterGroup ref={clusterRef} chunkedLoading iconCreateFunction={(cluster: { getChildCount(): number }) => getClusterIcon(cluster.getChildCount())}>
            {markers}
          </MarkerClusterGroup>
        ) : (
          markers
        )}
      </MapContainer>
    </div>
  );
}
export default ProviderMap;
