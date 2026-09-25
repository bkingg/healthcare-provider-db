"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localizedText } from "@/lib/localizedText";
import { ProviderHeader, type ProfileTab } from "./provider-header";
import { PnTag } from "@/components/pn-tag";
import { RatingsWidget, type RatingCriteriaText } from "./ratings-widget";
import { AddressesSection, type CountryOption } from "./addresses-section";
import { CanEditProvider } from "@/lib/can-edit-context";
import { ContactsSection } from "./contacts-section";
import { TaxonomySection } from "./taxonomy-section";
import { CredentialsSection } from "./credentials-section";
import { ContractsSection } from "./contracts-section";
import { NetworkGroupsSection } from "./network-groups-section";
import { AffiliationsSection } from "./affiliations-section";
import { BankingSection } from "./banking-section";
import { RatesSection } from "./rates-section";
import { VisitsSection } from "./visits-section";
import { NotesSection } from "./notes-section";
import { NotesWidget } from "./notes-widget";
import { WebsiteWidget } from "./website-widget";
import type { ProviderProfile } from "@/data/providers";
import type { DqRuleRef, DataQualityException } from "../../../../../../generated/prisma/client";

type Options = { id: string; label: string }[];

function KvRow({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="text-[10.5px] tracking-[0.05em] text-pn-gray-3 uppercase">{label}</div>
      <div className="text-[12.5px] text-pn-ink">{value}</div>
    </>
  );
  const cls = "grid grid-cols-[minmax(110px,150px)_minmax(0,1fr)] items-baseline gap-3 border-b border-pn-rule py-1.5 text-left";
  // Rows that summarize another tab are links to it — the detail lives there,
  // so the Overview doesn't have to repeat it.
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} w-full cursor-pointer hover:bg-pn-surface-hover`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function TagRow({ label, values, onClick }: { label: string; values: string[]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full cursor-pointer grid-cols-[minmax(110px,150px)_minmax(0,1fr)] items-baseline gap-3 border-b border-pn-rule py-1.5 text-left hover:bg-pn-surface-hover"
    >
      <div className="text-[10.5px] tracking-[0.05em] text-pn-gray-3 uppercase">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="border border-pn-border-muted px-1.5 py-px text-[11.5px] text-pn-ink">
            {v}
          </span>
        ))}
      </div>
    </button>
  );
}

/** The header already shows name, status, operating status, type and country,
 * and the sidebar shows the rating, so none of those are repeated here. Only
 * filled-in fields get a row; what's missing collapses into one "Not filled
 * in" line whose links jump to the tab where it's entered. */
function OverviewTab({ provider, onTabChange }: { provider: ProviderProfile; onTabChange: (tab: ProfileTab) => void }) {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const alternateNames = provider.names.filter((n) => !n.isPrimary).map((n) => `${n.fullNameText} (${n.nameType})`);
  const primaryAddress = provider.addresses.find((a) => a.isPrimary) ?? provider.addresses[0];
  const mainPhone = provider.phones[0];
  const mainEmail = provider.emails[0];
  const adminContact = provider.administrativeContacts[0];
  const specialties = provider.specialties.map((s) => localizedText(s.specialty.nameEn, s.specialty.nameFr, locale) ?? s.specialty.nameEn);
  const languages = provider.languages.map((l) => localizedText(l.language.nameEn, l.language.nameFr, locale) ?? l.language.nameEn);
  const capabilities = provider.capabilities.map((c) => localizedText(c.capability.nameEn, c.capability.nameFr, locale) ?? c.capability.nameEn);
  const specializedNetworks = provider.specializedNetworks.map((n) => n.specializedNetwork.name);
  const customizedClientNetworks = provider.customizedClientNetworks.map((n) => n.customizedClientNetwork.name);

  const goContacts = () => onTabChange("Contacts & locations");
  const goClinical = () => onTabChange("Clinical services");
  const goNetworks = () => onTabChange("Contracts & networks");

  const missing: { label: string; tab: ProfileTab }[] = [
    ...(primaryAddress ? [] : [{ label: t("primaryAddress"), tab: "Contacts & locations" as const }]),
    ...(mainPhone ? [] : [{ label: t("mainPhone"), tab: "Contacts & locations" as const }]),
    ...(mainEmail ? [] : [{ label: t("mainEmail"), tab: "Contacts & locations" as const }]),
    ...(adminContact ? [] : [{ label: t("adminContact"), tab: "Contacts & locations" as const }]),
    ...(specialties.length ? [] : [{ label: t("specialties"), tab: "Clinical services" as const }]),
    ...(languages.length ? [] : [{ label: t("languages"), tab: "Clinical services" as const }]),
    ...(capabilities.length ? [] : [{ label: t("capabilities"), tab: "Clinical services" as const }]),
  ];

  const hasMain = provider.profileSummary || alternateNames.length > 0 || provider.externalId;
  const hasLocation = primaryAddress || mainPhone || mainEmail || adminContact;
  const hasClinical = specialties.length > 0 || languages.length > 0 || capabilities.length > 0;

  return (
    <div className="flex flex-col gap-4 py-4">
      {hasMain && (
        <section>
          <h2 className="m-0 mb-1.5 text-xs font-extrabold tracking-[0.09em] uppercase">{t("sectionMainInfo")}</h2>
          {provider.profileSummary && <p className="m-0 mb-2 text-[12.5px] leading-snug text-pn-ink">{provider.profileSummary}</p>}
          {alternateNames.length > 0 && <KvRow label={t("nameVariants")} value={alternateNames.join("; ")} />}
          {provider.externalId && <KvRow label={t("externalId")} value={provider.externalId} />}
        </section>
      )}

      {hasLocation && (
        <section>
          <h2 className="m-0 mb-1.5 text-xs font-extrabold tracking-[0.09em] uppercase">{t("sectionLocationContacts")}</h2>
          {primaryAddress && <KvRow label={t("primaryAddress")} value={`${primaryAddress.line1}, ${primaryAddress.city}`} onClick={goContacts} />}
          {mainPhone && <KvRow label={t("mainPhone")} value={`${mainPhone.number} (${mainPhone.phoneType.name})`} onClick={goContacts} />}
          {mainEmail && <KvRow label={t("mainEmail")} value={`${mainEmail.address} (${mainEmail.emailType.name})`} onClick={goContacts} />}
          {adminContact && <KvRow label={t("adminContact")} value={`${adminContact.firstName} ${adminContact.lastName}`} onClick={goContacts} />}
        </section>
      )}

      {hasClinical && (
        <section>
          <h2 className="m-0 mb-1.5 text-xs font-extrabold tracking-[0.09em] uppercase">{t("sectionClinicalServices")}</h2>
          {specialties.length > 0 && <TagRow label={t("specialties")} values={specialties} onClick={goClinical} />}
          {languages.length > 0 && <TagRow label={t("languages")} values={languages} onClick={goClinical} />}
          {capabilities.length > 0 && <TagRow label={t("capabilities")} values={capabilities} onClick={goClinical} />}
        </section>
      )}

      {(specializedNetworks.length > 0 || customizedClientNetworks.length > 0) && (
        <section>
          <h2 className="m-0 mb-1.5 text-xs font-extrabold tracking-[0.09em] uppercase">{t("sectionNetworks")}</h2>
          {specializedNetworks.length > 0 && <TagRow label={t("specializedNetwork")} values={specializedNetworks} onClick={goNetworks} />}
          {customizedClientNetworks.length > 0 && <TagRow label={t("customizedClientNetwork")} values={customizedClientNetworks} onClick={goNetworks} />}
        </section>
      )}

      {missing.length > 0 && (
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-pn-gray-3">
          <span>{t("notFilledIn")}</span>
          {missing.map((m, i) => (
            <span key={m.label}>
              <button type="button" onClick={() => onTabChange(m.tab)} className="cursor-pointer text-pn-accent underline-offset-2 hover:underline">
                {m.label}
              </button>
              {i < missing.length - 1 ? "," : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function ProfileBody({
  provider,
  gaps,
  exceptions,
  providerTypes,
  countries,
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
  ratingCriteria,
  validateRecordTooltip,
  canViewBanking,
  canManageBanking,
  canEdit,
}: {
  provider: ProviderProfile;
  gaps: string[];
  exceptions: (DataQualityException & { rule: DqRuleRef })[];
  providerTypes: Options;
  countries: CountryOption[];
  addressTypes: Options;
  phoneTypes: Options;
  emailTypes: Options;
  specialties: Options;
  languages: Options;
  capabilities: Options;
  credentialTypes: Options;
  credentialStatuses: Options;
  networks: Options;
  affiliationTypes: Options;
  paymentTypes: (Options[number] & { category: string })[];
  bankAccountTypes: Options;
  serviceTypes: Options;
  documentCategories: Options;
  retentionClasses: Options;
  users: Options;
  titles: Options;
  departments: Options;
  specializedNetworks: Options;
  customizedClientNetworks: Options;
  ratingCriteria: RatingCriteriaText;
  validateRecordTooltip: string | null;
  canViewBanking: boolean;
  canManageBanking: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("Profile");
  const tGaps = useTranslations("ActivationGaps");
  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");

  return (
    <CanEditProvider canEdit={canEdit}>
    <div className="flex min-h-0 flex-1 flex-col">
      <ProviderHeader
        provider={provider}
        countries={countries}
        titles={titles}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        validateRecordTooltip={validateRecordTooltip}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] overflow-auto max-[1040px]:grid-cols-[minmax(0,1fr)]">
        <div className="min-w-0 border-r-2 border-pn-ink px-5 pb-10 max-[1040px]:border-r-0">
          {activeTab === "Overview" && <OverviewTab provider={provider} onTabChange={setActiveTab} />}
          {activeTab === "Contacts & locations" && (
            <div className="flex flex-col gap-4 py-4">
              <AddressesSection provider={provider} addressTypes={addressTypes} countries={countries} />
              <ContactsSection provider={provider} phoneTypes={phoneTypes} emailTypes={emailTypes} departments={departments} />
            </div>
          )}
          {activeTab === "Clinical services" && (
            <div className="py-4">
              <TaxonomySection provider={provider} providerTypes={providerTypes} specialties={specialties} languages={languages} capabilities={capabilities} />
            </div>
          )}
          {activeTab === "Credentials" && (
            <div className="py-4">
              <CredentialsSection provider={provider} credentialTypes={credentialTypes} credentialStatuses={credentialStatuses} />
            </div>
          )}
          {activeTab === "Contracts & networks" && (
            <div className="flex flex-col gap-4 py-4">
              <ContractsSection provider={provider} networks={networks} />
              <AffiliationsSection provider={provider} affiliationTypes={affiliationTypes} />
              <NetworkGroupsSection provider={provider} specializedNetworks={specializedNetworks} customizedClientNetworks={customizedClientNetworks} />
            </div>
          )}
          {activeTab === "Banking" && (
            <div className="py-4">
              <BankingSection
                provider={provider}
                paymentTypes={paymentTypes}
                bankAccountTypes={bankAccountTypes}
                canView={canViewBanking}
                canManage={canManageBanking}
              />
            </div>
          )}
          {activeTab === "Visits" && (
            <div className="py-4">
              <VisitsSection provider={provider} users={users} />
            </div>
          )}
          {activeTab === "Rates" && (
            <div className="py-4">
              <RatesSection provider={provider} serviceTypes={serviceTypes} />
            </div>
          )}
          {activeTab === "Notes & documents" && (
            <div className="py-4">
              <NotesSection provider={provider} documentCategories={documentCategories} retentionClasses={retentionClasses} />
            </div>
          )}
        </div>

        <aside className="px-4.5 py-4 max-[1040px]:border-t-2 max-[1040px]:border-pn-ink">
          <RatingsWidget
            providerId={provider.id}
            quality={provider.qualityRating}
            access={provider.accessRating}
            criteria={ratingCriteria}
          />

          <NotesWidget providerId={provider.id} internalNotes={provider.internalNotes} externalNotes={provider.externalNotes} />

          <WebsiteWidget providerId={provider.id} websiteUrl1={provider.websiteUrl1} websiteUrl2={provider.websiteUrl2} />

          {/* One panel instead of separate "readiness" and "exceptions"
           * boxes — they mostly flag the same problems from two angles. */}
          <div className={`border-2 ${gaps.length + exceptions.length === 0 ? "border-pn-ink" : "border-pn-accent"}`}>
            <div
              className={`flex justify-between px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] uppercase ${
                gaps.length + exceptions.length === 0 ? "bg-pn-ink text-white" : "bg-pn-accent text-white"
              }`}
            >
              <span>{t("needsAttention")}</span>
              <span>{gaps.length + exceptions.length}</span>
            </div>
            {gaps.length + exceptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-pn-gray-2">{t("allClear")}</div>
            ) : (
              <>
                {gaps.map((gap) => (
                  <div key={gap} className="flex items-center gap-2 border-b border-pn-rule px-3 py-1.5 text-xs">
                    <div className="h-[11px] w-[11px] flex-none border-2 border-pn-accent bg-pn-accent-soft-2" />
                    <span className="flex-1 text-pn-ink">{tGaps(gap)}</span>
                  </div>
                ))}
                {exceptions.map((e) => (
                  <div key={e.id} className="border-b border-pn-rule px-3 py-2.5">
                    <div className="flex justify-between gap-2 text-[11px] tracking-[0.04em] text-pn-gray-3">
                      <span>{e.rule.code}</span>
                      <PnTag status={e.severity} />
                    </div>
                    <div className="mt-[3px] text-[12.5px] leading-tight">{e.rule.description}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
    </CanEditProvider>
  );
}
