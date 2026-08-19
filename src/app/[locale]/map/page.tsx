import { getLocale, getTranslations } from "next-intl/server";
import { searchProvidersForMap } from "@/data/search";
import { listCapabilities, listCountries, listNetworks, listProviderTypes, listRegions, listSpecialties } from "@/data/referenceData";
import { localizedText } from "@/lib/localizedText";
import { parseSearchParams } from "@/lib/validation/search";
import { ProviderTypeLevel } from "@/lib/enums";
import { SearchFilterBar } from "../providers/_components/search-filter-bar";
import { MapSearchView } from "./_components/map-search-view";
import { getCurrentActor } from "@/lib/actor";
import { maxSearchResults } from "@/lib/rbac";

export default async function MapPage(props: PageProps<"/[locale]/map">) {
  const t = await getTranslations("Map");
  const locale = await getLocale();
  const rawSearchParams = await props.searchParams;
  const filters = parseSearchParams(rawSearchParams);
  const actor = await getCurrentActor();
  const cap = maxSearchResults(actor);

  const [{ providers, total, truncated, limit }, countries, regions, providerTypesRaw, specialties, capabilities, networks] = await Promise.all([
    searchProvidersForMap(filters, cap),
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
  const providerTypes = providerTypesRaw.filter((pt) => pt.level !== ProviderTypeLevel.CATEGORY);

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
        basePath="/map"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-none border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        </div>

        <MapSearchView providers={providers} total={total} truncated={truncated} limit={limit} filters={filters} rawParams={rawSearchParams} basePath="/map" />
      </div>
    </div>
  );
}
