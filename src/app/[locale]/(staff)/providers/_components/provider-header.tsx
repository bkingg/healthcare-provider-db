"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, ClipboardCopy, Copy, History, Pencil } from "lucide-react";
import { setProviderStatusAction, updateProviderCoreAction, verifyProviderRecordAction } from "@/app/[locale]/(staff)/providers/actions";
import { PnTag } from "@/components/pn-tag";
import { DoNotUseFlag } from "@/components/do-not-use-flag";
import { HoverTip } from "@/components/ui/tooltip";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCanEdit } from "@/lib/can-edit-context";
import { useOpenTabs } from "@/lib/open-tabs-context";
import { formatProviderNumber } from "@/lib/providerNumber";
import { localizedText } from "@/lib/localizedText";
import { healthSystemRatingClasses } from "@/lib/healthSystemRating";
import { formatDakarDate, formatDakarDateTime } from "@/lib/formatDate";
import { OperatingStatus, ProviderNameKind, ProviderStatus } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";
import { staffLabel } from "@/lib/handle";
import { TagToCaseButton } from "@/components/tag-to-case-button";

// Internal English identifiers — used for tab-switch state/comparisons in
// profile-body.tsx, not shown to the user. Display labels come from the
// Profile.tab* translation keys below (see TAB_MESSAGE_KEYS).
const TABS = [
  "Overview",
  "Contacts & locations",
  "Clinical services",
  "Credentials",
  "Contracts & networks",
  "Banking",
  "Visits",
  "Rates",
  "Notes & documents",
] as const;
export type ProfileTab = (typeof TABS)[number];

const TAB_MESSAGE_KEYS: Record<ProfileTab, string> = {
  Overview: "tabOverview",
  "Contacts & locations": "tabContacts",
  "Clinical services": "tabClinical",
  Credentials: "tabCredentials",
  "Contracts & networks": "tabContracts",
  Banking: "tabBanking",
  Visits: "tabVisits",
  Rates: "tabRates",
  "Notes & documents": "tabNotes",
};

/** Split out of ProviderHeader and remounted (via `key={provider.updatedAt}`
 * at the call site) on every successful save — otherwise the dialog stays
 * mounted across edits and its uncontrolled fields (including the nameKind
 * toggle's own useState) keep showing what was true when it first opened,
 * not the freshly saved values a `revalidatePath` refresh just brought in.
 * Same staleness class as the Clinical services tab's checkbox forms; Base
 * UI's Select actually warns about it ("changing the default value state of
 * an uncontrolled Select after being initialized"), which is how this was
 * caught. */
function EditProviderForm({
  provider,
  countries,
  titles,
  coreAction,
  coreErrors,
}: {
  provider: ProviderProfile;
  countries: { id: string; label: string }[];
  titles: { id: string; label: string }[];
  coreAction: (formData: FormData) => void;
  coreErrors: Record<string, string[]>;
}) {
  const t = useTranslations("Profile");
  const tw = useTranslations("Wizard");
  const primaryName = provider.names.find((n) => n.isPrimary) ?? provider.names[0];
  const [nameKind, setNameKind] = useState<ProviderNameKind>(provider.nameKind);

  return (
    <form action={coreAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={provider.id} />
      <input type="hidden" name="nameKind" value={nameKind} />
      <div className="flex flex-col gap-1.5">
        <Label>{tw("nameKind")}</Label>
        <div className="flex gap-2">
          {([ProviderNameKind.ENTITY, ProviderNameKind.INDIVIDUAL] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setNameKind(kind)}
              className={`cursor-pointer border-2 px-3 py-1.5 text-[12.5px] font-semibold ${
                nameKind === kind
                  ? "border-pn-ink bg-pn-ink text-white"
                  : "border-pn-border-muted text-pn-gray-2 hover:border-pn-ink hover:text-pn-ink"
              }`}
            >
              {kind === ProviderNameKind.ENTITY ? tw("entity") : tw("individual")}
            </button>
          ))}
        </div>
      </div>
      {nameKind === ProviderNameKind.ENTITY ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="facilityName">{tw("organizationName")}</Label>
          <Input id="facilityName" name="facilityName" defaultValue={primaryName?.facilityName ?? ""} required />
          <FieldError messages={coreErrors.facilityName} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{tw("individualPrefix")}</Label>
            <RefSelect
              name="individualTitleId"
              options={titles}
              defaultValue={primaryName?.individualTitleId ?? undefined}
              placeholder={tw("individualPrefixPlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="individualFirstName">{tw("individualFirstName")}</Label>
            <Input id="individualFirstName" name="individualFirstName" defaultValue={primaryName?.individualFirstName ?? ""} required />
            <FieldError messages={coreErrors.individualFirstName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="individualLastName">{tw("individualLastName")}</Label>
            <Input id="individualLastName" name="individualLastName" defaultValue={primaryName?.individualLastName ?? ""} required />
            <FieldError messages={coreErrors.individualLastName} />
          </div>
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <Label>{t("country")}</Label>
        <RefSelect name="countryId" options={countries} defaultValue={provider.countryId} required />
        <FieldError messages={coreErrors.countryId} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("operatingStatus")}</Label>
        <RefSelect
          name="operatingStatus"
          options={Object.values(OperatingStatus).map((v) => ({ id: v, label: v.replaceAll("_", " ") }))}
          defaultValue={provider.operatingStatus}
          required
        />
        <FieldError messages={coreErrors.operatingStatus} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="externalId">{t("externalId")}</Label>
        <Input id="externalId" name="externalId" defaultValue={provider.externalId ?? ""} />
        <FieldError messages={coreErrors.externalId} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profileSummary">{t("profileSummary")}</Label>
        <Textarea id="profileSummary" name="profileSummary" rows={3} defaultValue={provider.profileSummary ?? ""} />
        <FieldError messages={coreErrors.profileSummary} />
      </div>
      <SubmitButton className="self-start">{t("save")}</SubmitButton>
    </form>
  );
}

/** The provider's short ID (NMD-000123), with click-to-copy. */
function CopyIdButton({ code }: { code: string }) {
  const t = useTranslations("Profile");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={t("copyId")}
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex cursor-pointer items-center gap-1 text-[11px] text-pn-gray-3 hover:text-pn-ink"
    >
      <span className="font-semibold tabular-nums text-pn-gray-2">{code}</span>
      {copied ? <CheckCircle2 size={11} className="text-pn-accent" /> : <Copy size={11} />}
      {copied && t("idCopied")}
    </button>
  );
}

/** Plain-text summary of a record's key fields, meant to paste cleanly into
 * an email or Word document — one "Label: value" line per field, primary
 * address/phone/email only, blank fields omitted entirely. */
function buildProviderSummaryText(provider: ProviderProfile, t: ReturnType<typeof useTranslations>): string {
  const primaryName = provider.names.find((n) => n.isPrimary) ?? provider.names[0];
  const primaryAddress = provider.addresses.find((a) => a.isPrimary) ?? provider.addresses[0];
  const primaryPhone = provider.phones[0];
  const primaryEmail = provider.emails[0];

  const addressLine = primaryAddress
    ? [primaryAddress.line1, primaryAddress.line2, [primaryAddress.city, primaryAddress.stateProvince].filter(Boolean).join(", "), primaryAddress.postalCode, primaryAddress.country.name]
        .filter(Boolean)
        .join(", ")
    : null;
  const websiteLine = [provider.websiteUrl1, provider.websiteUrl2].filter(Boolean).join(" / ") || null;

  const lines: [string, string | null | undefined][] = [
    [t("clipboardName"), primaryName?.fullNameText],
    [t("clipboardAddress"), addressLine],
    [t("clipboardPhone"), primaryPhone?.number],
    [t("clipboardWebsite"), websiteLine],
    [t("clipboardEmail"), primaryEmail?.address],
    [t("clipboardExternalComment"), provider.externalNotes],
  ];

  return lines
    .filter(([, value]) => !!value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** Copies a plain-text summary (name, address, phone, website, email,
 * external comment) of the whole record — meant for pasting into an email
 * or Word document, not just the record's short ID (see CopyIdButton). */
function CopyRecordButton({ provider }: { provider: ProviderProfile }) {
  const t = useTranslations("Profile");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(buildProviderSummaryText(provider, t)).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
    >
      {copied ? <CheckCircle2 size={14} className="text-pn-accent" /> : <ClipboardCopy size={14} />}
      {copied ? t("recordCopied") : t("copyRecord")}
    </button>
  );
}

export function ProviderHeader({
  provider,
  countries,
  titles,
  activeTab,
  onTabChange,
  validateRecordTooltip,
}: {
  provider: ProviderProfile;
  countries: { id: string; label: string }[];
  titles: { id: string; label: string }[];
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  validateRecordTooltip: string | null;
}) {
  const t = useTranslations("Profile");
  const tGaps = useTranslations("ActivationGaps");
  const locale = useLocale();
  const canEdit = useCanEdit();
  const primaryName = provider.names.find((n) => n.isPrimary) ?? provider.names[0];
  const primaryProviderType = provider.providerTypes.find((pt) => pt.isPrimary) ?? provider.providerTypes[0];
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const { openTab } = useOpenTabs();
  const displayName = primaryName?.fullNameText ?? t("unnamed");
  useEffect(() => {
    openTab({ id: provider.id, name: displayName });
  }, [provider.id, displayName, openTab]);

  const [statusState, statusAction] = useActionState<ActionResult | null, FormData>(setProviderStatusAction, null);
  const statusErrors = statusState && !statusState.success ? statusState.errors : {};

  const [coreState, coreAction] = useActionState<ActionResult | null, FormData>(updateProviderCoreAction, null);
  const coreErrors = coreState && !coreState.success ? coreState.errors : {};

  return (
    <div className="flex-none border-b-2 border-pn-ink px-5 pt-3.5">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 text-[11px] tracking-[0.04em] text-pn-gray-3">
            <Link href="/providers" className="cursor-pointer hover:text-pn-ink">
              {t("breadcrumb")}
            </Link>
            <CopyIdButton code={formatProviderNumber(provider.providerNumber)} />
          </div>
          <h1 className="mt-[5px] flex items-center gap-2 text-[26px] font-extrabold tracking-[-0.025em]">
            <DoNotUseFlag status={provider.status} size={22} />
            {displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="border-2 border-pn-ink px-[7px] py-px text-[11px] font-semibold">
              {(primaryProviderType && localizedText(primaryProviderType.providerType.nameEn, primaryProviderType.providerType.nameFr, locale)) ?? t("noType")}
            </span>
            {canEdit ? (
            <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
              <DialogTrigger render={<button type="button" className="cursor-pointer"><PnTag status={provider.status} /></button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("changeStatus")}</DialogTitle>
                </DialogHeader>
                {/* Remounted on every successful save (see EditProviderForm's
                 * comment above) — otherwise this dialog stays mounted
                 * across edits and RefSelect's defaultValue={provider.status}
                 * changes on an already-initialized uncontrolled Select,
                 * which is exactly what Base UI's warning is about. */}
                <form key={provider.updatedAt.getTime()} action={statusAction} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={provider.id} />
                  <div className="flex flex-col gap-1.5">
                    <Label>{t("status")}</Label>
                    <RefSelect
                      name="status"
                      options={Object.values(ProviderStatus).map((v) => ({ id: v, label: v.replaceAll("_", " ") }))}
                      defaultValue={provider.status}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reason">{t("reason")}</Label>
                    <Input id="reason" name="reason" placeholder={t("reasonPlaceholder")} />
                  </div>
                  {statusErrors.status && (
                    <p className="text-xs text-pn-accent">{t("cannotActivate", { reasons: statusErrors.status.map((g) => tGaps(g)).join("; ") })}</p>
                  )}
                  <SubmitButton className="self-start">{t("updateStatus")}</SubmitButton>
                </form>
              </DialogContent>
            </Dialog>
            ) : (
              <PnTag status={provider.status} />
            )}
            <PnTag status={provider.operatingStatus} />
            <span className="ml-1 text-[11.5px] text-pn-gray-2">
              {provider.country.name}
              {provider.country.region ? ` · ${provider.country.region.name}` : ""}
            </span>
            {(() => {
              // Hidden entirely when the country has no rating — only shown
              // once the country's health system has an actual rating.
              const rating = provider.country.qualityRating;
              const value = rating?.numericValue != null ? Number(rating.numericValue) : null;
              if (value === null) return null;
              return (
                <HoverTip content={localizedText(rating?.descriptionEn, rating?.descriptionFr, locale)}>
                  <span className={`border-2 px-[7px] py-px text-[11px] font-semibold ${healthSystemRatingClasses(value)}`}>
                    {t("healthcareSystem")}: {rating?.label} ({value})
                  </span>
                </HoverTip>
              );
            })()}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-pn-gray-3">
            {provider.updatedBy && (
              <span>
                {t("lastUpdatedBy", { name: staffLabel(provider.updatedBy), date: formatDakarDateTime(provider.updatedAt, locale) })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-none flex-col items-end gap-1 pt-4">
          <div className="flex flex-wrap justify-end gap-2">
            <TagToCaseButton providerId={provider.id} size="md" />
            <CopyRecordButton provider={provider} />
            <Button variant="outline" disabled className="flex h-8 items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold">
              <History size={14} /> {t("auditHistory")}
            </Button>
            {canEdit && (
              <>
                <HoverTip content={validateRecordTooltip}>
                  <form action={verifyProviderRecordAction}>
                    <input type="hidden" name="id" value={provider.id} />
                    <button
                      type="submit"
                      className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
                    >
                      <CheckCircle2 size={14} /> {t("validateRecord")}
                    </button>
                  </form>
                </HoverTip>
                <form action={statusAction}>
                  <input type="hidden" name="id" value={provider.id} />
                  <input type="hidden" name="status" value={ProviderStatus.INACTIVE} />
                  <button
                    type="submit"
                    className="flex h-8 cursor-pointer items-center border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
                  >
                    {t("deactivate")}
                  </button>
                </form>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger
                    render={
                      <button className="flex h-8 items-center gap-[7px] border-none bg-pn-accent px-3.5 text-xs font-semibold text-white hover:bg-pn-accent-hover">
                        <Pencil size={14} /> {t("editProfile")}
                      </button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("editDetails")}</DialogTitle>
                    </DialogHeader>
                    <EditProviderForm
                      key={provider.updatedAt.getTime()}
                      provider={provider}
                      countries={countries}
                      titles={titles}
                      coreAction={coreAction}
                      coreErrors={coreErrors}
                    />
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
          <div className="text-[11px] text-pn-gray-3">
            {provider.lastVerifiedBy && provider.lastVerifiedAt ? (
              <span className="flex items-center gap-1 text-pn-gray-2">
                <CheckCircle2 size={12} className="text-pn-accent" />
                {t("verifiedBy", { name: staffLabel(provider.lastVerifiedBy), date: formatDakarDate(provider.lastVerifiedAt, locale) })}
              </span>
            ) : (
              <span>{t("notYetVerified")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex gap-0 overflow-auto">
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`flex cursor-pointer items-center gap-1.5 border-none border-b-[3px] bg-transparent px-3.5 py-2 text-[12.5px] whitespace-nowrap transition-colors ${
                active
                  ? "border-pn-accent font-bold text-pn-ink"
                  : "border-transparent font-medium text-pn-gray-2 hover:border-pn-rule hover:text-pn-ink"
              }`}
            >
              {t(TAB_MESSAGE_KEYS[tab])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
