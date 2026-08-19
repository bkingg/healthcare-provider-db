"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type L from "leaflet";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PnTag } from "@/components/pn-tag";
import { getMarkerIcon } from "./marker-icons";
import { haversineDistanceKm } from "./geo-math";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export type MapProvider = {
  id: string;
  name: string;
  typeCode?: string;
  typeName: string;
  status: string;
  ratingLabel?: string;
  lat: number;
  lng: number;
  coordinateStatus: string;
};

const DAKAR_FALLBACK_CENTER: [number, number] = [14.7167, -17.4677];

/** Fits the map to the current marker set exactly once per distinct id set
 * (a filter change), rather than fighting the user's own pan/zoom on every
 * render — re-fitting on every render would make "Search this area" and the
 * circle tool unusable (the view would snap back as soon as the data
 * refetches). */
function FitToMarkers({ providers }: { providers: MapProvider[] }) {
  const map = useMap();
  const idsKey = providers
    .map((p) => p.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (providers.length === 0) return;
    if (providers.length === 1) {
      map.setView([providers[0].lat, providers[0].lng], 13);
      return;
    }
    const bounds = providers.map((p): [number, number] => [p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the *set* of markers changes, not on every render
  }, [idsKey]);

  return null;
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
  activeCircle,
  circleToolActive,
  onSearchArea,
  onCircleComplete,
}: {
  providers: MapProvider[];
  selectedProviderId: string | null;
  onSelectProvider: (id: string | null) => void;
  activeCircle: { lat: number; lng: number; radiusKm: number } | null;
  circleToolActive: boolean;
  onSearchArea: (bounds: L.LatLngBounds) => void;
  onCircleComplete: (center: { lat: number; lng: number }, radiusKm: number) => void;
}) {
  const t = useTranslations("Map");
  const markerRefs = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    if (!selectedProviderId) return;
    markerRefs.current.get(selectedProviderId)?.openPopup();
  }, [selectedProviderId]);

  const initialCenter = useMemo<[number, number]>(() => {
    if (providers[0]) return [providers[0].lat, providers[0].lng];
    return DAKAR_FALLBACK_CENTER;
  }, [providers]);

  return (
    <div className="relative h-full w-full">
      <MapContainer center={initialCenter} zoom={11} className="h-full w-full" scrollWheelZoom>
        {/* Required OpenStreetMap attribution — always visible, per OSM's
         * license terms, not just noted in a footer. */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        />
        <FitToMarkers providers={providers} />
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
        <MarkerClusterGroup chunkedLoading>
          {providers.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={getMarkerIcon(p.typeCode)}
              ref={(ref) => {
                if (ref) markerRefs.current.set(p.id, ref);
                else markerRefs.current.delete(p.id);
              }}
              eventHandlers={{ click: () => onSelectProvider(p.id) }}
            >
              <Popup>
                <div className="flex min-w-[180px] flex-col gap-1">
                  <div className="text-[13px] font-bold text-pn-ink">{p.name}</div>
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
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

export default ProviderMap;
