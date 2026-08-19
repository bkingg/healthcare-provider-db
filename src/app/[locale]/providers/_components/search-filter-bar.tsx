import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FilterPill } from "@/components/filter-pill";
import { toggleParamHref } from "@/lib/searchParamsHref";
import { ProviderNameKind, ProviderStatus } from "@/lib/enums";
import { DistanceFilter } from "./distance-filter";
import { isDefaultStatuses, type SearchFilters } from "@/lib/validation/search";

type Options = { id: string; label: string }[];
type RawParams = Record<string, string | string[] | undefined>;

function FilterGroup({
  label,
  paramKey,
  options,
  selected,
  rawParams,
  basePath,
}: {
  label: string;
  paramKey: string;
  options: Options;
  selected: string[];
  rawParams: RawParams;
  basePath: string;
}) {
  return (
    <div className="border-b border-pn-rule px-3.5 pt-2.5 pb-3">
      <div className="mb-[7px] text-[10px] tracking-[0.08em] text-pn-gray-3 uppercase">{label}</div>
      <div className="flex flex-wrap gap-[5px]">
        {options.map((o) => (
          <FilterPill
            key={o.id}
            label={o.label}
            active={selected.includes(o.id)}
            href={toggleParamHref(basePath, rawParams, paramKey, o.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Reused by both `/providers` (default `basePath`) and `/map` — same
 * filters either way (see `buildProviderWhereClause` in `src/data/search.ts`,
 * which both pages' data-fetching goes through), so this stays one
 * component parameterized by where its links should point rather than a
 * forked copy per page. */
export async function SearchFilterBar({
  filters,
  rawParams,
  countries,
  regions,
  providerTypes,
  specialties,
  capabilities,
  networks,
  basePath = "/providers",
}: {
  filters: SearchFilters;
  rawParams: RawParams;
  countries: Options;
  regions: Options;
  providerTypes: Options;
  specialties: Options;
  capabilities: Options;
  networks: Options;
  basePath?: string;
}) {
  const t = await getTranslations("Search");
  const locale = await getLocale();
  // Same "is the circle filter actually in effect" condition as
  // resolveGeoFilter in src/data/search.ts: radiusKm alone (or lat/lng
  // alone) never applies anything on its own. Without this, the header's
  // "Clear (n)" link stayed hidden whenever a distance-from-point search was
  // the only filter set — there was nothing wrong with what it cleared (a
  // full reset to just `q` already dropped lat/lng/radiusKm/pointLabel/bbox
  // same as everything else), only with when it bothered to show up.
  const hasDistanceFilter = filters.lat !== undefined && filters.lng !== undefined && filters.radiusKm !== undefined;
  const activeCount =
    filters.countryIds.length +
    filters.regionIds.length +
    filters.providerTypeIds.length +
    filters.specialtyIds.length +
    filters.capabilityIds.length +
    filters.networkIds.length +
    // Active-only is the default, so it isn't a filter the user set.
    (isDefaultStatuses(filters.statuses) ? 0 : filters.statuses.length || 1) +
    filters.nameKinds.length +
    (filters.needsLocationReview ? 1 : 0) +
    (filters.isOpen24_7 ? 1 : 0) +
    (filters.erOpen24_7 ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (hasDistanceFilter ? 1 : 0) +
    (filters.bbox ? 1 : 0);

  // Keeps only the text search (`q`), which is what "Clear filters" means
  // here — dropping every other key (including lat/lng/radiusKm/pointLabel/
  // bbox, none of which get a case of their own) clears the distance-from-
  // point circle and the map's "search this area" box along with every pill
  // filter. Omitted entirely rather than `{ q: filters.q }` when there's no
  // active query: `URLSearchParams` stringifies an `undefined` value as the
  // literal text "undefined" (`new URLSearchParams({ q: undefined })` →
  // "q=undefined"), which would have turned "Clear filters" into "search for
  // the word undefined" — silently returning zero results — for the common
  // case of filtering without ever typing anything in the search box.
  const clearedParams: RawParams = filters.q ? { q: filters.q } : {};
  const clearedQuery = new URLSearchParams(clearedParams as Record<string, string>).toString();
  const clearedHref = clearedQuery ? `${basePath}?${clearedQuery}` : basePath;

  return (
    <aside data-r="filters" className="max-[1040px]:hidden flex-none w-[236px] overflow-auto border-r-2 border-pn-ink pb-6">
      <div className="flex items-center justify-between border-b-2 border-pn-ink px-3.5 py-3">
        <span className="text-[11px] font-bold tracking-[0.1em] uppercase">{t("filters")}</span>
        {activeCount > 0 && (
          <Link href={clearedHref} className="text-[11px] font-semibold text-[#0a5c3c]">
            {t("clear", { count: activeCount })}
          </Link>
        )}
      </div>

      {/* On the geospatial search screen (/map), distance-from-point is the
       * filter people reach for first — the whole point of that page is
       * searching around a location — so it leads the column there. On
       * /providers, where it's one filter among many, it stays in its usual
       * spot below the pill groups. */}
      {basePath === "/map" && <DistanceFilter filters={filters} rawParams={rawParams} locale={locale} basePath={basePath} />}

      <FilterGroup
        label={t("providerType")}
        paramKey="providerTypeIds"
        options={providerTypes}
        selected={filters.providerTypeIds}
        rawParams={rawParams}
        basePath={basePath}
      />
      <FilterGroup
        label={t("recordType")}
        paramKey="nameKinds"
        options={[
          { id: ProviderNameKind.ENTITY, label: t("entity") },
          { id: ProviderNameKind.INDIVIDUAL, label: t("individual") },
        ]}
        selected={filters.nameKinds}
        rawParams={rawParams}
        basePath={basePath}
      />
      <FilterGroup label={t("country")} paramKey="countryIds" options={countries} selected={filters.countryIds} rawParams={rawParams} basePath={basePath} />
      <FilterGroup label={t("region")} paramKey="regionIds" options={regions} selected={filters.regionIds} rawParams={rawParams} basePath={basePath} />
      <FilterGroup
        label={t("status")}
        paramKey="statuses"
        options={Object.values(ProviderStatus).map((v) => ({ id: v, label: v.replaceAll("_", " ") }))}
        selected={filters.statuses}
        rawParams={rawParams}
        basePath={basePath}
      />
      <FilterGroup
        label={t("specialty")}
        paramKey="specialtyIds"
        options={specialties}
        selected={filters.specialtyIds}
        rawParams={rawParams}
        basePath={basePath}
      />
      <FilterGroup
        label={t("capability")}
        paramKey="capabilityIds"
        options={capabilities}
        selected={filters.capabilityIds}
        rawParams={rawParams}
        basePath={basePath}
      />
      <FilterGroup label={t("network")} paramKey="networkIds" options={networks} selected={filters.networkIds} rawParams={rawParams} basePath={basePath} />
      <FilterGroup
        label={t("locationQuality")}
        paramKey="needsLocationReview"
        options={[{ id: "1", label: t("needsLocationReview") }]}
        selected={filters.needsLocationReview ? ["1"] : []}
        rawParams={rawParams}
        basePath={basePath}
      />
      {/* Two independent booleans (Provider.isOpen24_7 / erOpen24_7), not a
       * single multi-value param, so this can't be a plain FilterGroup (one
       * paramKey per group) — each pill toggles its own param directly. */}
      <div className="border-b border-pn-rule px-3.5 pt-2.5 pb-3">
        <div className="mb-[7px] text-[10px] tracking-[0.08em] text-pn-gray-3 uppercase">{t("availability")}</div>
        <div className="flex flex-wrap gap-[5px]">
          <FilterPill label={t("isOpen24_7")} active={filters.isOpen24_7} href={toggleParamHref(basePath, rawParams, "isOpen24_7", "1")} />
          <FilterPill label={t("erOpen24_7")} active={filters.erOpen24_7} href={toggleParamHref(basePath, rawParams, "erOpen24_7", "1")} />
        </div>
      </div>

      {basePath !== "/map" && <DistanceFilter filters={filters} rawParams={rawParams} locale={locale} basePath={basePath} />}
    </aside>
  );
}
