"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SearchFilters } from "@/lib/validation/search";

type RawParams = Record<string, string | string[] | undefined>;
type GeocodeResult = { label: string; lat: number; lng: number };

// Matches the server proxy's own throttle (src/app/api/geocode/search/route.ts)
// so client requests naturally land under Nominatim's ~1 req/sec usage policy
// instead of routinely getting 429'd by our own throttle.
const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

// Slider bounds — narrower than the server's validated range (0.1–20000km,
// see radiusKm in src/lib/validation/search.ts) because that range only
// exists to accommodate the map's freehand circle tool; a "distance from
// point" search is inherently local, and a linear slider spanning 20000km
// would make every practical value (a few km to a couple hundred) an
// imprecise sliver at the very bottom.
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 300;
const DEFAULT_RADIUS_KM = 10;

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
  // Clamped in case the active radius came from the map's freehand circle
  // tool, which isn't bound by the slider's narrower range (see
  // MAX_RADIUS_KM above) — an out-of-range `value` would desync the range
  // input's real DOM value (which the browser clamps) from this state.
  const [radiusKm, setRadiusKm] = useState(() => {
    const initial = filters.radiusKm ?? DEFAULT_RADIUS_KM;
    return Math.min(Math.max(initial, MIN_RADIUS_KM), MAX_RADIUS_KM);
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const queryTooShortOrUnchanged = query.trim().length < MIN_QUERY_LENGTH || query === selected?.label;

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
    <div className="px-3.5 pt-3">
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
        <input type="hidden" name="lat" value={selected?.lat ?? ""} />
        <input type="hidden" name="lng" value={selected?.lng ?? ""} />
        <input type="hidden" name="pointLabel" value={selected?.label ?? ""} />

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

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-pn-gray-3">
            <span>{t("radiusKm")}</span>
            <span className="font-semibold text-pn-ink">{t("radiusKmValue", { km: radiusKm })}</span>
          </div>
          <input
            type="range"
            name="radiusKm"
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={1}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            aria-label={t("radiusKm")}
            className="h-1.5 w-full cursor-pointer accent-pn-accent"
          />
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
