import { getLocale } from "next-intl/server";
import { listCountries, listProviderTitles, listProviderTypes } from "@/data/referenceData";
import { localizedText } from "@/lib/localizedText";
import { ProviderTypeLevel } from "@/lib/enums";
import { NewProviderForm } from "./new-provider-form";

export default async function NewProviderPage() {
  const [countries, providerTypes, titles] = await Promise.all([listCountries(), listProviderTypes(), listProviderTitles()]);
  const locale = await getLocale();
  const selectableTypes = providerTypes.filter((t) => t.level !== ProviderTypeLevel.CATEGORY);

  return (
    <NewProviderForm
      countries={countries.map((c) => ({ id: c.id, label: c.name }))}
      providerTypes={selectableTypes.map((t) => ({ id: t.id, label: localizedText(t.nameEn, t.nameFr, locale) ?? t.nameEn }))}
      titles={titles.map((t) => ({ id: t.id, label: t.name }))}
    />
  );
}
