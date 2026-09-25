import { notFound } from "next/navigation";
import { formatProviderNumber } from "@/lib/providerNumber";
import { getLocale, getTranslations } from "next-intl/server";
import { localizedText } from "@/lib/localizedText";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getActivationGaps, getProviderProfile } from "@/data/providers";
import {
  listAddressTypes,
  listCapabilities,
  listCountries,
  listDepartments,
  listEmailTypes,
  listLanguages,
  listPhoneTypes,
  listProviderTitles,
  listProviderTypes,
  listSpecialties,
} from "@/data/referenceData";
import { ProviderTypeLevel } from "@/lib/enums";
import { WizardShell } from "@/components/wizard-shell";
import { ProviderNamesSection } from "../../_components/provider-names-section";
import { AddressesSection } from "../../_components/addresses-section";
import { ContactsSection } from "../../_components/contacts-section";
import { TaxonomySection } from "../../_components/taxonomy-section";

// Step numbers map to Wizard.step{N}Title/Description translation keys.
const STEP_KEYS: Record<number, { titleKey: string; descriptionKey: string }> = {
  2: { titleKey: "step2Title", descriptionKey: "step2Description" },
  3: { titleKey: "step3Title", descriptionKey: "step3Description" },
  4: { titleKey: "step4Title", descriptionKey: "step4Description" },
  5: { titleKey: "step5Title", descriptionKey: "step5Description" },
  6: { titleKey: "step6Title", descriptionKey: "step6Description" },
};

export default async function NewProviderStepPage(props: PageProps<"/[locale]/providers/new/[id]">) {
  const t = await getTranslations("Wizard");
  const tGaps = await getTranslations("ActivationGaps");
  const locale = await getLocale();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const step = Math.min(6, Math.max(2, Number(searchParams.step) || 2));

  const [provider, gaps, addressTypes, countries, phoneTypes, emailTypes, specialties, languages, capabilities, providerTypesRaw, titles, departments] =
    await Promise.all([
      getProviderProfile(id),
      getActivationGaps(id),
      listAddressTypes(),
      listCountries(),
      listPhoneTypes(),
      listEmailTypes(),
      listSpecialties(),
      listLanguages(),
      listCapabilities(),
      listProviderTypes(),
      listProviderTitles(),
      listDepartments(),
    ]);

  if (!provider) notFound();

  const toOptions = (items: { id: string; name: string }[]) => items.map((i) => ({ id: i.id, label: i.name }));
  const toLocalizedOptions = (items: { id: string; nameEn: string; nameFr: string | null }[]) =>
    items.map((i) => ({ id: i.id, label: localizedText(i.nameEn, i.nameFr, locale) ?? i.nameEn }));
  const providerTypes = toLocalizedOptions(providerTypesRaw.filter((t) => t.level !== ProviderTypeLevel.CATEGORY));
  // Countries carry `iso2` too — the address search typeahead in
  // AddressesSection matches a Nominatim result's country code against it.
  const countryOptions = countries.map((c) => ({ id: c.id, label: c.name, iso2: c.iso2 }));
  const meta = STEP_KEYS[step];

  return (
    <WizardShell
      currentStep={step}
      subtitle={t("draftSubtitle", { name: provider.names[0]?.fullNameText ?? formatProviderNumber(provider.providerNumber) })}
      backHref={step > 2 ? `/providers/new/${id}?step=${step - 1}` : undefined}
      continueHref={step < 6 ? `/providers/new/${id}?step=${step + 1}` : undefined}
      continueSlot={step === 6 ? <Button render={<Link href={`/providers/${id}`}>{t("finish")}</Link>} /> : undefined}
      sideContent={
        <div className="border-2 border-pn-ink">
          <div className="bg-pn-ink px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] text-white uppercase">{t("beforeActivation")}</div>
          {gaps.length === 0 ? (
            <div className="px-3 py-2 text-xs text-pn-gray-2">{t("allRequirementsMet")}</div>
          ) : (
            gaps.map((gap) => (
              <div key={gap} className="border-b border-pn-rule px-3 py-2 text-xs text-pn-gray-2 last:border-b-0">
                {tGaps(gap)}
              </div>
            ))
          )}
        </div>
      }
    >
      <h2 className="m-0 mb-[3px] text-base font-extrabold tracking-[-0.01em]">{t(meta.titleKey)}</h2>
      <p className="m-0 mb-4 max-w-[60ch] text-[12.5px] text-pn-gray-2">{t(meta.descriptionKey)}</p>

      {step === 2 && <ProviderNamesSection provider={provider} titles={toOptions(titles)} />}
      {step === 3 && <AddressesSection provider={provider} addressTypes={toOptions(addressTypes)} countries={countryOptions} />}
      {step === 4 && <ContactsSection provider={provider} phoneTypes={toOptions(phoneTypes)} emailTypes={toOptions(emailTypes)} departments={toOptions(departments)} />}
      {step === 5 && (
        <TaxonomySection
          provider={provider}
          providerTypes={providerTypes}
          specialties={toLocalizedOptions(specialties)}
          languages={toLocalizedOptions(languages)}
          capabilities={toLocalizedOptions(capabilities)}
        />
      )}
      {step === 6 && (
        <div className="border-2 border-pn-ink p-4">
          {gaps.length === 0 ? (
            <p className="m-0 text-[13px] text-pn-ink">{t("meetsRequirements")}</p>
          ) : (
            <>
              <p className="m-0 mb-2 text-[13px] text-pn-ink">{t("stillMissing")}</p>
              <ul className="m-0 list-disc pl-5 text-[12.5px] text-pn-gray-2">
                {gaps.map((gap) => (
                  <li key={gap}>{tGaps(gap)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </WizardShell>
  );
}
