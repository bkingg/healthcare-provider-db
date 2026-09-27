import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentActor } from "@/lib/actor";
import { canEditProviderData } from "@/lib/rbac";
import { localizedText } from "@/lib/localizedText";
import { getActivationGaps, getProviderProfile } from "@/data/providers";
import { canViewBanking, canManageBanking } from "@/data/financial";
import { listExceptionsForProvider } from "@/data/dataQualityExceptions";
import {
  listAddressTypes,
  listAffiliationTypes,
  listCapabilities,
  listCountries,
  listCredentialStatuses,
  listCredentialTypes,
  listDepartments,
  listCustomizedClientNetworks,
  listDocumentCategories,
  listEmailTypes,
  listLanguages,
  listNetworks,
  listPaymentTypes,
  listBankAccountTypes,
  listPhoneTypes,
  listProviderTitles,
  listRatingCriteria,
  listProviderTypes,
  listRetentionClasses,
  listServiceTypes,
  listSpecialties,
  listSpecializedNetworks,
  listUiHints,
  listUsers,
} from "@/data/referenceData";
import { ProfileBody } from "../_components/profile-body";
import { staffLabel } from "@/lib/handle";

export default async function ProviderProfilePage(props: PageProps<"/[locale]/providers/[id]">) {
  const { id } = await props.params;
  const locale = await getLocale();

  const [
    provider,
    actor,
    gaps,
    exceptions,
    countries,
    providerTypes,
    addressTypes,
    phoneTypes,
    emailTypes,
    specialties,
    languages,
    capabilities,
    credentialTypes,
    credentialStatuses,
    networks,
    affiliationTypes,
    paymentTypes,
    bankAccountTypes,
    serviceTypes,
    documentCategories,
    retentionClasses,
    users,
    titles,
    departments,
    specializedNetworks,
    customizedClientNetworks,
    ratingCriteriaRows,
    uiHints,
  ] = await Promise.all([
    getProviderProfile(id),
    getCurrentActor(),
    getActivationGaps(id),
    listExceptionsForProvider(id),
    listCountries(),
    listProviderTypes(),
    listAddressTypes(),
    listPhoneTypes(),
    listEmailTypes(),
    listSpecialties(),
    listLanguages(),
    listCapabilities(),
    listCredentialTypes(),
    listCredentialStatuses(),
    listNetworks(),
    listAffiliationTypes(),
    listPaymentTypes(),
    listBankAccountTypes(),
    listServiceTypes(),
    listDocumentCategories(),
    listRetentionClasses(),
    listUsers(),
    listProviderTitles(),
    listDepartments(),
    listSpecializedNetworks(),
    listCustomizedClientNetworks(),
    listRatingCriteria(),
    listUiHints(),
  ]);

  if (!provider) notFound();

  const toOptions = (items: { id: string; name: string }[]) => items.map((i) => ({ id: i.id, label: i.name }));
  // Provider types / specialties / languages / capabilities are the four
  // reference lists with an admin-maintained French translation
  // (nameEn/nameFr) — this picks the display language instead of always
  // showing English like the plain `toOptions` above.
  const toLocalizedOptions = (items: { id: string; nameEn: string; nameFr: string | null }[]) =>
    items.map((i) => ({ id: i.id, label: localizedText(i.nameEn, i.nameFr, locale) ?? i.nameEn }));
  // Countries carry `iso2` too — the address search typeahead in
  // AddressesSection matches a Nominatim result's country code against it.
  const countryOptions = countries.map((c) => ({ id: c.id, label: c.name, iso2: c.iso2 }));
  const criterionText = (code: string) => {
    const c = ratingCriteriaRows.find((r) => r.code === code);
    return {
      description: localizedText(c?.descriptionEn, c?.descriptionFr, locale),
      meanings: [
        localizedText(c?.level1MeaningEn, c?.level1MeaningFr, locale),
        localizedText(c?.level2MeaningEn, c?.level2MeaningFr, locale),
        localizedText(c?.level3MeaningEn, c?.level3MeaningFr, locale),
        localizedText(c?.level4MeaningEn, c?.level4MeaningFr, locale),
        localizedText(c?.level5MeaningEn, c?.level5MeaningFr, locale),
      ],
    };
  };
  const userOptions = users.map((u) => ({ id: u.id, label: staffLabel(u) }));
  const validateHint = uiHints.find((h) => h.code === "VALIDATE_RECORD");
  const validateRecordTooltip = localizedText(validateHint?.descriptionEn, validateHint?.descriptionFr, locale);

  return (
    <ProfileBody
      provider={provider}
      gaps={gaps}
      exceptions={exceptions}
      providerTypes={toLocalizedOptions(providerTypes)}
      countries={countryOptions}
      addressTypes={toOptions(addressTypes)}
      phoneTypes={toOptions(phoneTypes)}
      emailTypes={toOptions(emailTypes)}
      specialties={toLocalizedOptions(specialties)}
      languages={toLocalizedOptions(languages)}
      capabilities={toLocalizedOptions(capabilities)}
      credentialTypes={toOptions(credentialTypes)}
      credentialStatuses={toOptions(credentialStatuses)}
      networks={toOptions(networks)}
      affiliationTypes={toOptions(affiliationTypes)}
      paymentTypes={paymentTypes.map((p) => ({ id: p.id, label: p.name, category: p.category }))}
      bankAccountTypes={toOptions(bankAccountTypes)}
      serviceTypes={toOptions(serviceTypes)}
      documentCategories={toOptions(documentCategories)}
      retentionClasses={toOptions(retentionClasses)}
      users={userOptions}
      titles={toOptions(titles)}
      departments={toOptions(departments)}
      specializedNetworks={toOptions(specializedNetworks)}
      customizedClientNetworks={toOptions(customizedClientNetworks)}
      ratingCriteria={{ quality: criterionText("QUALITY"), access: criterionText("ACCESS") }}
      validateRecordTooltip={validateRecordTooltip}
      canViewBanking={canViewBanking(actor)}
      canManageBanking={canManageBanking(actor)}
      canEdit={canEditProviderData(actor)}
    />
  );
}
