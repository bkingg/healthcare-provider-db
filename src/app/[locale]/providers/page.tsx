import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MapPinned, Plus, SlidersHorizontal } from "lucide-react";
import { searchProviders } from "@/data/search";
import { listCapabilities, listCountries, listNetworks, listProviderTypes, listRegions, listSpecialties } from "@/data/referenceData";
import { localizedText } from "@/lib/localizedText";
import { parseSearchParams } from "@/lib/validation/search";
import { mapExportHref, nextCursorHref, prevCursorHref } from "@/lib/searchParamsHref";
import { ProviderTypeLevel } from "@/lib/enums";
import { getCurrentActor } from "@/lib/actor";
import { maxSearchResults } from "@/lib/rbac";
import { SearchFilterBar } from "./_components/search-filter-bar";
import { ResultsTable } from "./_components/results-table";
import { ColumnsMenu } from "./_components/columns-menu";
import { PageSizeSelect } from "@/components/page-size-select";

export default async function ProvidersPage(props: PageProps<"/[locale]/providers">) {
  const t = await getTranslations("Search");
  const locale = await getLocale();
  const rawSearchParams = await props.searchParams;
  const filters = parseSearchParams(rawSearchParams);
  const actor = await getCurrentActor();
  const cap = maxSearchResults(actor);

  const [{ providers, total, page, pageSize, hasNextPage, hasPrevPage, nextCursorToken, capped }, countries, regions, providerTypesRaw, specialties, capabilities, networks] =
    await Promise.all([
      searchProviders(filters, cap),
      listCountries(),
      listRegions(),
      listProviderTypes(),
      listSpecialties(),
      listCapabilities(),
      listNetworks(),
    ]);

  const toOptions = (items: { id: string; name: string }[]) => items.map((i) => ({ id: i.id, label: i.name }));
  const toLocalizedOptions = (items: { id: string; nameEn: string; nameFr: string | null }[]) =>
    items.map((i) => ({ id: i.id, label: localizedText(i.nameEn, i.nameFr, locale) ?? i.nameEn }));
  const providerTypes = providerTypesRaw.filter((t) => t.level !== ProviderTypeLevel.CATEGORY);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex min-h-0 flex-1">
      <SearchFilterBar
        filters={filters}
        rawParams={rawSearchParams}
        countries={toOptions(countries)}
        regions={toOptions(regions)}
        providerTypes={toLocalizedOptions(providerTypes)}
        specialties={toLocalizedOptions(specialties)}
        capabilities={toLocalizedOptions(capabilities)}
        networks={toOptions(networks)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-none border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
          <div className="flex items-end justify-between gap-5">
            <div>
              <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
              <div className="mt-[5px] text-xs text-pn-gray-2">
                <strong className="text-pn-ink tabular-nums">{total.toLocaleString()}</strong> {t("resultsLabel")}
              </div>
              {capped && cap !== null && <div className="mt-1 text-[11px] font-semibold text-pn-accent">{t("resultsCapped", { cap })}</div>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                data-r="filters-btn"
                className="hidden h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover max-[1040px]:flex"
              >
                <SlidersHorizontal size={14} /> {t("filters")}
              </button>
              <ColumnsMenu />
              {/* "Export" sends the whole current search to the Map page. */}
              <Link
                href={mapExportHref(rawSearchParams)}
                className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
              >
                <MapPinned size={14} /> {t("exportToMap")}
              </Link>
              <Link
                href="/providers/new"
                className="flex h-8 items-center gap-[7px] border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover"
              >
                <Plus size={14} /> {t("newProvider")}
              </Link>
            </div>
          </div>
        </div>

        <ResultsTable providers={providers} rawParams={rawSearchParams} sort={filters.sort} dir={filters.dir} />

        <div className="flex flex-none items-center justify-between border-t-2 border-pn-ink bg-pn-panel px-5 py-2 text-[11.5px]">
          <span className="text-pn-gray-2">{t("rowsOf", { start, end, total: total.toLocaleString() })}</span>
          <div className="flex items-center gap-3.5 text-pn-gray-2">
            <PageSizeSelect pageSize={pageSize} rawParams={rawSearchParams} />
            <div className="flex gap-0">
              <Link
                href={prevCursorHref("/providers", rawSearchParams, filters.cursors)}
                className={`flex h-6 w-[26px] items-center justify-center border-2 border-pn-ink ${!hasPrevPage ? "pointer-events-none opacity-40" : "hover:bg-pn-surface-hover"}`}
              >
                ‹
              </Link>
              <Link
                href={nextCursorToken ? nextCursorHref("/providers", rawSearchParams, filters.cursors, nextCursorToken) : "#"}
                className={`flex h-6 w-[26px] items-center justify-center border-2 border-l-0 border-pn-ink ${!hasNextPage ? "pointer-events-none opacity-40" : "hover:bg-pn-surface-hover"}`}
              >
                ›
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
