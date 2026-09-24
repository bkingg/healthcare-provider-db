"use client";

import { useMemo, useState } from "react";
import { formatProviderRating } from "@/lib/providerRating";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { localizedText } from "@/lib/localizedText";
import { resolveMarkerStyle } from "@/lib/mapMarkerStyle";
import { CircleDot, List, MapIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { PnTag } from "@/components/pn-tag";
import { DoNotUseFlag, isDoNotUse } from "@/components/do-not-use-flag";
import type { searchProvidersForMap } from "@/data/search";
import type { SearchFilters } from "@/lib/validation/search";
import type { MapProvider } from "./provider-map";

type RawParams = Record<string, string | string[] | undefined>;
type Provider = Awaited<ReturnType<typeof searchProvidersForMap>>["providers"][number];

// Leaflet touches `window` at module load, so the map can only ever render
// client-side — dynamic-imported with ssr:false rather than just "use client"
// (which alone still runs once on the server for the initial HTML).
const ProviderMap = dynamic(() => import("./provider-map").then((m) => m.ProviderMap), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-sm text-pn-gray-3">Loading map…</div>,
});

function toMapProvider(p: Provider, locale: string): MapProvider | null {
  const address = p.addresses[0];
  if (!address || address.latitude === null || address.longitude === null) return null;
  const primaryType = p.providerTypes.find((pt) => pt.isPrimary) ?? p.providerTypes[0];
  return {
    id: p.id,
    name: p.names[0]?.fullNameText ?? p.id,
    marker: resolveMarkerStyle(primaryType?.providerType),
    doNotUse: isDoNotUse(p.status),
    typeName: (primaryType && localizedText(primaryType.providerType.nameEn, primaryType.providerType.nameFr, locale)) ?? "—",
    status: p.status,
    ratingLabel: formatProviderRating(p.qualityRating, p.accessRating) ?? undefined,
    lat: address.latitude,
    lng: address.longitude,
    coordinateStatus: address.coordinateStatus,
  };
}

function buildParams(rawParams: RawParams, overrides: Record<string, string | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(rawParams)) {
    if (k === "cursors" || k in overrides) continue;
    for (const single of Array.isArray(v) ? v : v ? [v] : []) params.append(k, single);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) params.set(k, v);
  }
  return params;
}

export function MapSearchView({
  providers,
  total,
  truncated,
  limit,
  filters,
  rawParams,
  basePath,
}: {
  providers: Provider[];
  total: number;
  truncated: boolean;
  limit: number;
  filters: SearchFilters;
  rawParams: RawParams;
  basePath: string;
}) {
  const t = useTranslations("Map");
  const locale = useLocale();
  const router = useRouter();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [circleToolActive, setCircleToolActive] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("map");

  const mapProviders = useMemo(
    () => providers.map((p) => toMapProvider(p, locale)).filter((p): p is MapProvider => p !== null),
    [providers, locale],
  );
  const unmappedCount = providers.length - mapProviders.length;

  const activeCircle =
    filters.lat !== undefined && filters.lng !== undefined && filters.radiusKm !== undefined
      ? { lat: filters.lat, lng: filters.lng, radiusKm: filters.radiusKm, label: filters.pointLabel }
      : null;

  function navigate(overrides: Record<string, string | undefined>) {
    router.push(`${basePath}?${buildParams(rawParams, overrides).toString()}`);
  }

  function handleSearchArea(bounds: { getSouth(): number; getWest(): number; getNorth(): number; getEast(): number }) {
    // "Search this area" and the circle tool are mutually exclusive spatial
    // filters — setting one clears the other's params (see
    // buildProviderWhereClause's comment in src/data/search.ts).
    navigate({
      bbox: `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`,
      lat: undefined,
      lng: undefined,
      radiusKm: undefined,
      pointLabel: undefined,
    });
  }

  function handleCircleComplete(center: { lat: number; lng: number }, radiusKm: number) {
    setCircleToolActive(false);
    navigate({
      lat: String(center.lat),
      lng: String(center.lng),
      radiusKm: String(Math.max(0.1, Math.round(radiusKm * 10) / 10)),
      pointLabel: t("circleToolLabel"),
      bbox: undefined,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between gap-3 border-b-2 border-pn-ink px-5 py-2.5">
        <div className="text-xs text-pn-gray-2">
          {truncated ? t("resultsTruncated", { limit, total }) : t("resultsCount", { total })}
          {unmappedCount > 0 && <span className="ml-2 text-pn-gray-3">· {t("unmappedCount", { count: unmappedCount })}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCircleToolActive((v) => !v)}
            className={`flex h-7 cursor-pointer items-center gap-1.5 border-2 px-2.5 text-xs font-semibold ${
              circleToolActive ? "border-pn-ink bg-pn-ink text-white" : "border-pn-ink bg-transparent hover:bg-pn-surface-hover"
            }`}
          >
            <CircleDot size={13} /> {t("circleToFind")}
          </button>
          <div className="hidden gap-0 max-[860px]:flex">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className={`flex h-7 cursor-pointer items-center gap-1 border-2 border-pn-ink px-2.5 text-xs font-semibold ${mobileView === "list" ? "bg-pn-ink text-white" : "bg-transparent hover:bg-pn-surface-hover"}`}
            >
              <List size={13} /> {t("viewList")}
            </button>
            <button
              type="button"
              onClick={() => setMobileView("map")}
              className={`flex h-7 cursor-pointer items-center gap-1 border-2 border-l-0 border-pn-ink px-2.5 text-xs font-semibold ${mobileView === "map" ? "bg-pn-ink text-white" : "bg-transparent hover:bg-pn-surface-hover"}`}
            >
              <MapIcon size={13} /> {t("viewMap")}
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] max-[860px]:grid-cols-1">
        <div
          className={`min-h-0 overflow-auto border-r-2 border-pn-ink max-[860px]:border-r-0 ${mobileView === "map" ? "max-[860px]:hidden" : ""}`}
        >
          {providers.length === 0 && <div className="p-6 text-center text-sm text-pn-gray-3">{t("noResults")}</div>}
          {providers.map((p) => {
            const primaryType = p.providerTypes.find((pt) => pt.isPrimary) ?? p.providerTypes[0];
            const address = p.addresses[0];
            const hasLocation = Boolean(address && address.latitude !== null && address.longitude !== null);
            const selected = selectedProviderId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => hasLocation && setSelectedProviderId(p.id)}
                className={`block w-full cursor-pointer border-b border-pn-rule px-3.5 py-2.5 text-left ${selected ? "bg-pn-surface-hover" : "hover:bg-pn-surface-hover"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <DoNotUseFlag status={p.status} />
                    <span className="truncate text-[12.5px] font-semibold text-pn-ink">{p.names[0]?.fullNameText ?? p.id}</span>
                  </span>
                  <PnTag status={p.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-pn-gray-2">
                  <span>{(primaryType && localizedText(primaryType.providerType.nameEn, primaryType.providerType.nameFr, locale)) ?? "—"}</span>
                  <span>·</span>
                  <span>{p.country.name}</span>
                  {address ? <span>· {address.city}</span> : null}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {!hasLocation && <PnTag status="MISSING" />}
                  {hasLocation && address && address.coordinateStatus !== "CONFIRMED" && <PnTag status={address.coordinateStatus} />}
                </div>
              </button>
            );
          })}
        </div>

        <div className={`min-h-0 ${mobileView === "list" ? "max-[860px]:hidden" : ""}`}>
          <ProviderMap
            providers={mapProviders}
            selectedProviderId={selectedProviderId}
            onSelectProvider={setSelectedProviderId}
            activeCircle={activeCircle}
            circleToolActive={circleToolActive}
            onSearchArea={handleSearchArea}
            onCircleComplete={handleCircleComplete}
          />
        </div>
      </div>
    </div>
  );
}
