"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localizedText } from "@/lib/localizedText";
import {
  addProviderCapabilityAction,
  deleteOfficeHoursAction,
  removeProviderCapabilityAction,
  setProviderLanguagesAction,
  setProviderSpecialtiesAction,
  setProviderTypesAction,
  updateProviderAvailabilityAction,
} from "@/app/[locale]/providers/actions";
import { PnPanel } from "@/components/pn-section";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RefSelect } from "@/components/ref-select";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { DAY_MESSAGE_KEYS, OfficeHoursDialog } from "./office-hours-dialog";
import { formatTimeOfDay } from "@/lib/officeHours";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

export function TaxonomySection({
  provider,
  providerTypes,
  specialties,
  languages,
  capabilities,
}: {
  provider: ProviderProfile;
  providerTypes: { id: string; label: string }[];
  specialties: { id: string; label: string }[];
  languages: { id: string; label: string }[];
  capabilities: { id: string; label: string }[];
}) {
  const t = useTranslations("Taxonomy");
  const locale = useLocale();
  const assignedProviderTypeIds = new Set(provider.providerTypes.map((pt) => pt.providerTypeId));
  const primaryProviderType = provider.providerTypes.find((pt) => pt.isPrimary);
  const assignedSpecialtyIds = new Set(provider.specialties.map((s) => s.specialtyId));
  const primarySpecialty = provider.specialties.find((s) => s.isPrimary);
  const assignedLanguageIds = new Set(provider.languages.map((l) => l.languageId));
  const assignedCapabilityIds = new Set(provider.capabilities.map((c) => c.capabilityId));

  const [capState, capFormAction] = useActionState<ActionResult | null, FormData>(addProviderCapabilityAction, null);
  void capState; // errors not surfaced individually here; capability list is short and low-stakes

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PnPanel title={t("providerTypes")}>
          <form
            key={[...assignedProviderTypeIds].sort().join(",") + "|" + (primaryProviderType?.providerTypeId ?? "")}
            action={setProviderTypesAction}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="providerId" value={provider.id} />
            {providerTypes.map((providerType) => (
              <div key={providerType.id} className="flex items-center gap-2">
                <Checkbox
                  id={`provider-type-${providerType.id}`}
                  name="providerTypeIds"
                  value={providerType.id}
                  defaultChecked={assignedProviderTypeIds.has(providerType.id)}
                />
                <Label htmlFor={`provider-type-${providerType.id}`} className="flex-1 font-normal">
                  {providerType.label}
                </Label>
              </div>
            ))}
            <div className="flex flex-col gap-1.5 pt-2">
              <Label>{t("primaryType")}</Label>
              <RefSelect name="primaryProviderTypeId" options={providerTypes} defaultValue={primaryProviderType?.providerTypeId} placeholder={t("none")} />
            </div>
            <SubmitButton variant="outline" size="sm" className="self-start">
              {t("saveProviderTypes")}
            </SubmitButton>
          </form>
      </PnPanel>

      <PnPanel title={t("specialties")}>
          <form
            key={[...assignedSpecialtyIds].sort().join(",") + "|" + (primarySpecialty?.specialtyId ?? "")}
            action={setProviderSpecialtiesAction}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="providerId" value={provider.id} />
            {specialties.map((specialty) => (
              <div key={specialty.id} className="flex items-center gap-2">
                <Checkbox
                  id={`specialty-${specialty.id}`}
                  name="specialtyIds"
                  value={specialty.id}
                  defaultChecked={assignedSpecialtyIds.has(specialty.id)}
                />
                <Label htmlFor={`specialty-${specialty.id}`} className="flex-1 font-normal">
                  {specialty.label}
                </Label>
              </div>
            ))}
            <div className="flex flex-col gap-1.5 pt-2">
              <Label>{t("primarySpecialty")}</Label>
              <RefSelect name="primarySpecialtyId" options={specialties} defaultValue={primarySpecialty?.specialtyId} placeholder={t("none")} />
            </div>
            <SubmitButton variant="outline" size="sm" className="self-start">
              {t("saveSpecialties")}
            </SubmitButton>
          </form>
      </PnPanel>

      <PnPanel title={t("languages")}>
          <form key={[...assignedLanguageIds].sort().join(",")} action={setProviderLanguagesAction} className="flex flex-col gap-2">
            <input type="hidden" name="providerId" value={provider.id} />
            {languages.map((language) => (
              <div key={language.id} className="flex items-center gap-2">
                <Checkbox
                  id={`language-${language.id}`}
                  name="languageIds"
                  value={language.id}
                  defaultChecked={assignedLanguageIds.has(language.id)}
                />
                <Label htmlFor={`language-${language.id}`} className="flex-1 font-normal">
                  {language.label}
                </Label>
              </div>
            ))}
            <SubmitButton variant="outline" size="sm" className="self-start">
              {t("saveLanguages")}
            </SubmitButton>
          </form>
      </PnPanel>

      <PnPanel title={t("availability")}>
          <form
            key={`${provider.isOpen24_7}|${provider.erOpen24_7}`}
            action={updateProviderAvailabilityAction}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="id" value={provider.id} />
            <div className="flex items-center gap-2">
              <Checkbox id="isOpen24_7" name="isOpen24_7" defaultChecked={provider.isOpen24_7} />
              <Label htmlFor="isOpen24_7" className="flex-1 font-normal">
                {t("isOpen24_7")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="erOpen24_7" name="erOpen24_7" defaultChecked={provider.erOpen24_7} />
              <Label htmlFor="erOpen24_7" className="flex-1 font-normal">
                {t("erOpen24_7")}
              </Label>
            </div>
            <SubmitButton variant="outline" size="sm" className="self-start">
              {t("saveAvailability")}
            </SubmitButton>
          </form>

          <div className="mt-3 flex flex-col gap-2 border-t pt-3">
            <span className="text-xs font-semibold">{t("officeHours")}</span>
            {provider.officeHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOfficeHours")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {provider.officeHours.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between text-sm">
                    <span>
                      {t(DAY_MESSAGE_KEYS[entry.dayOfWeek])} · {formatTimeOfDay(entry.openTime)}–{formatTimeOfDay(entry.closeTime)}
                    </span>
                    <InlineDeleteForm action={deleteOfficeHoursAction} hiddenFields={{ id: entry.id, providerId: provider.id }} />
                  </li>
                ))}
              </ul>
            )}
            <OfficeHoursDialog providerId={provider.id} />
          </div>
      </PnPanel>

      <PnPanel title={t("capabilities")} className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {provider.capabilities.map((assignment) => (
              <li key={assignment.capabilityId} className="flex items-center justify-between text-sm">
                <span>
                  {localizedText(assignment.capability.nameEn, assignment.capability.nameFr, locale)}
                  {assignment.notes ? <span className="text-muted-foreground"> — {assignment.notes}</span> : null}
                </span>
                <InlineDeleteForm
                  action={removeProviderCapabilityAction}
                  hiddenFields={{ providerId: provider.id, capabilityId: assignment.capabilityId }}
                />
              </li>
            ))}
          </ul>
          <form action={capFormAction} className="flex flex-col gap-2">
            <input type="hidden" name="providerId" value={provider.id} />
            <RefSelect
              name="capabilityId"
              options={capabilities.filter((c) => !assignedCapabilityIds.has(c.id))}
              placeholder={t("addCapability")}
              required
            />
            <Input name="notes" placeholder={t("notesPlaceholder")} />
            <SubmitButton variant="outline" size="sm">
              {t("addCapability")}
            </SubmitButton>
          </form>
      </PnPanel>
    </div>
  );
}
