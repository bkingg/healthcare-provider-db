"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DEFAULT_RADIUS_KM, LABELLED_RADIUS_STOPS_KM, RADIUS_STOPS_KM, nearestRadiusStopIndex } from "./radius-stops";
import type { SearchFilters } from "@/lib/validation/search";
import { formatDecimalCoordinates, parseCoordinates } from "@/lib/coordinates";

type RawParams = Record<string, string | string[] | undefined>;
type GeocodeResult = { label: string; lat: number; lng: number };

// Matches the server proxy's own throttle (src/app/api/geocode/search/route.ts)
// so client requests naturally land under Nominatim's ~1 req/sec usage policy
// instead of routinely getting 429'd by our own throttle.
const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

// The slider steps through RADIUS_STOPS_KM (1–10km, 20km, 100km) — far
// narrower than the server's validated range (0.1–20000km, see radiusKm in
// src/lib/validation/search.ts), which only exists to accommodate the map's
// freehand circle tool.
const LAST_STOP = RADIUS_STOPS_KM.length - 1;

/** "Distance from point" filter — an address/venue typeahead (backed by
 * OpenStreetMap/Nominatim via /api/geocode/search) that resolves to a
 * lat/lng, plus the pre-existing radius input and Apply button. Split out of
 * SearchFilterBar (a server component) because the typeahead needs client
 * state; the surrounding <form> is still a plain native GET submit like
 * every other filter here, so Apply behaves exactly as before — the address
 * lookup only changes *how* lat/lng get filled in, not how they're applied. */
export function DistanceFilter({
  filters,
  rawParams,
  locale,
  basePath = "/providers",
}: {
  filters: SearchFilters;
  rawParams: RawParams;
  locale: string;
  basePath?: string;
}) {
  const t = useTranslations("Search");
  const initialSelected: GeocodeResult | null =
    filters.lat !== undefined && filters.lng !== undefined
      ? { label: filters.pointLabel ?? `${filters.lat}, ${filters.lng}`, lat: filters.lat, lng: filters.lng }
      : null;

  const [query, setQuery] = useState(initialSelected?.label ?? "");
  const [selected, setSelected] = useState<GeocodeResult | null>(initialSelected);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Position on the stepped scale, not km. A radius from the map's freehand
  // circle tool (which can be any value) snaps to the nearest stop.
  const [stopIndex, setStopIndex] = useState(() => nearestRadiusStopIndex(filters.radiusKm ?? DEFAULT_RADIUS_KM));
  const radiusKm = RADIUS_STOPS_KM[stopIndex];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Typed decimal coordinates are used as they are — no address lookup.
  const typedPoint = selected ? null : parseCoordinates(query);
  const point = selected ?? (typedPoint ? { ...typedPoint, label: formatDecimalCoordinates(typedPoint) } : null);
  const queryTooShortOrUnchanged = query.trim().length < MIN_QUERY_LENGTH || query === selected?.label || typedPoint !== null;

  useEffect(() => {
    if (queryTooShortOrUnchanged) return;
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data: { results: GeocodeResult[] } = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // Aborted by a newer keystroke, or a network hiccup — not worth
        // surfacing an error for a filter widget; the next keystroke retries.
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selected is read, not a trigger
  }, [query]);

  // Derived, not stored: avoids a synchronous setState in the effect above
  // just to clear stale results once the query drops below the minimum
  // length or matches what's already selected.
  const visibleResults = queryTooShortOrUnchanged ? [] : results;

  function selectResult(r: GeocodeResult) {
    setSelected(r);
    setQuery(r.label);
    setResults([]);
    setOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="border-b border-pn-rule px-3.5 pt-2.5 pb-3">
      <div className="mb-[7px] text-[10px] tracking-[0.08em] text-pn-gray-3 uppercase">{t("distanceFromPoint")}</div>
      {/* Native GET form, not next-intl's Link — action needs the locale
       * prefix applied by hand since forms aren't intercepted like Link/router. */}
      <form method="get" action={`/${locale}${basePath}`} className="flex flex-col gap-1.5">
        {Object.entries(rawParams).flatMap(([k, v]) =>
          k === "lat" || k === "lng" || k === "radiusKm" || k === "cursors" || k === "pointLabel" || k === "bbox"
            ? []
            : (Array.isArray(v) ? v : v ? [v] : []).map((val, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={val} />),
        )}
        {/* Setting the circle filter clears any active "search this area"
         * bbox — the two spatial tools are mutually exclusive (see
         * buildProviderWhereClause's comment in src/data/search.ts). */}
        <input type="hidden" name="lat" value={point?.lat ?? ""} />
        <input type="hidden" name="lng" value={point?.lng ?? ""} />
        <input type="hidden" name="pointLabel" value={point?.label ?? ""} />

        <div ref={containerRef} className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) setSelected(null);
            }}
            onFocus={() => visibleResults.length > 0 && setOpen(true)}
            placeholder={t("addressSearchPlaceholder")}
            autoComplete="off"
            className="h-7 w-full border-2 border-pn-ink bg-white px-2 pr-6 font-[inherit] text-xs"
          />
          {selected && (
            <button
              type="button"
              onClick={clearSelection}
              aria-label={t("clearPoint")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer text-sm leading-none text-pn-gray-3 hover:text-pn-ink"
            >
              ×
            </button>
          )}
          {open && (loading || visibleResults.length > 0) && (
            <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto border-2 border-pn-ink bg-white">
              {loading && <div className="px-2 py-1.5 text-xs text-pn-gray-3">{t("searchingAddress")}</div>}
              {!loading && visibleResults.length === 0 && <div className="px-2 py-1.5 text-xs text-pn-gray-3">{t("noAddressResults")}</div>}
              {!loading &&
                visibleResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectResult(r)}
                    className="block w-full cursor-pointer border-b border-pn-rule px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-pn-surface-hover"
                  >
                    {r.label}
                  </button>
                ))}
            </div>
          )}
        </div>
        {typedPoint && <div className="text-[11px] font-semibold text-[#0a5c3c]">{t("coordinatesRecognised", { point: formatDecimalCoordinates(typedPoint) })}</div>}

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-pn-gray-3">
            <span>{t("radiusKm")}</span>
            <span className="font-semibold text-pn-ink">{t("radiusKmValue", { km: radiusKm })}</span>
          </div>
          {/* The range input moves through stop indexes; the hidden input
           * is what the form actually submits, in km. */}
          <input type="hidden" name="radiusKm" value={radiusKm} />
          <input
            type="range"
            min={0}
            max={LAST_STOP}
            step={1}
            value={stopIndex}
            onChange={(e) => setStopIndex(Number(e.target.value))}
            aria-label={t("radiusKm")}
            aria-valuetext={t("radiusKmValue", { km: radiusKm })}
            className="h-1.5 w-full cursor-pointer accent-pn-accent"
          />
          {/* Scale labels under the notches they name. The steps aren't
           * evenly spaced in km, so these show where 10/20/100 actually sit.
           * Offsets assume the browser's ~16px range thumb, whose centre
           * travels from 8px in from each end of the track. */}
          <div aria-hidden className="relative h-3 text-[10px] text-pn-gray-3 tabular-nums">
            {LABELLED_RADIUS_STOPS_KM.map((km) => {
              const i = RADIUS_STOPS_KM.indexOf(km as (typeof RADIUS_STOPS_KM)[number]);
              const edge = i === 0 ? "translate-x-0" : i === LAST_STOP ? "-translate-x-full" : "-translate-x-1/2";
              return (
                <span
                  key={km}
                  className={`absolute top-0 ${edge} ${km === radiusKm ? "font-semibold text-pn-ink" : ""}`}
                  style={{ left: i === 0 ? 0 : i === LAST_STOP ? "100%" : `calc(8px + (100% - 16px) * ${i / LAST_STOP})` }}
                >
                  {km}
                </span>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          className="h-7 cursor-pointer border-2 border-pn-ink bg-transparent px-2 text-xs font-semibold hover:bg-pn-surface-hover"
        >
          {t("apply")}
        </button>
      </form>
    </div>
  );
}
