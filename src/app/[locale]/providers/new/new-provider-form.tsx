"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createProviderAction } from "@/app/[locale]/providers/actions";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { WizardFieldLabel } from "@/components/wizard-field";
import { WizardShell } from "@/components/wizard-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ProviderNameKind } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";

export function NewProviderForm({
  countries,
  providerTypes,
  titles,
}: {
  countries: { id: string; label: string }[];
  providerTypes: { id: string; label: string }[];
  titles: { id: string; label: string }[];
}) {
  const t = useTranslations("Wizard");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createProviderAction, null);
  const errors = state && !state.success ? state.errors : {};
  const [nameKind, setNameKind] = useState<ProviderNameKind>(ProviderNameKind.ENTITY);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <WizardShell
        currentStep={1}
        subtitle={t("newDraft")}
        continueSlot={<Button type="submit">{t("createAndContinue")}</Button>}
        sideContent={
          <div className="border-2 border-pn-ink">
            <div className="bg-pn-ink px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] text-white uppercase">{t("beforeActivation")}</div>
            <div className="border-b border-pn-rule px-3 py-2 text-xs text-pn-gray-2">{t("reqProviderName")}</div>
            <div className="border-b border-pn-rule px-3 py-2 text-xs text-pn-gray-2">{t("reqProviderType")}</div>
            <div className="border-b border-pn-rule px-3 py-2 text-xs text-pn-gray-2">{t("reqCountry")}</div>
            <div className="px-3 py-2 text-xs text-pn-gray-2">{t("reqLocationOrContact")}</div>
          </div>
        }
      >
        <h2 className="m-0 mb-[3px] text-base font-extrabold tracking-[-0.01em]">{t("identityTitle")}</h2>
        <p className="m-0 mb-4 max-w-[60ch] text-[12.5px] text-pn-gray-2">{t("identityDescription")}</p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="col-span-full flex flex-col">
            <WizardFieldLabel label={t("nameKind")} required />
            <input type="hidden" name="nameKind" value={nameKind} />
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
                  {kind === ProviderNameKind.ENTITY ? t("entity") : t("individual")}
                </button>
              ))}
            </div>
          </div>

          {nameKind === ProviderNameKind.ENTITY ? (
            <label className="col-span-full flex flex-col">
              <WizardFieldLabel label={t("organizationName")} required />
              <Input id="facilityName" name="facilityName" required />
              <FieldError messages={errors.facilityName} />
            </label>
          ) : (
            <>
              <label className="flex flex-col">
                <WizardFieldLabel label={t("individualPrefix")} />
                <RefSelect name="individualTitleId" options={titles} placeholder={t("individualPrefixPlaceholder")} />
              </label>
              <div />
              <label className="flex flex-col">
                <WizardFieldLabel label={t("individualFirstName")} required />
                <Input id="individualFirstName" name="individualFirstName" required />
                <FieldError messages={errors.individualFirstName} />
              </label>
              <label className="flex flex-col">
                <WizardFieldLabel label={t("individualLastName")} required />
                <Input id="individualLastName" name="individualLastName" required />
                <FieldError messages={errors.individualLastName} />
              </label>
            </>
          )}

          <div className="col-span-full flex flex-col">
            <WizardFieldLabel label={t("reqProviderType")} required />
            <div className="flex flex-col gap-1.5 border-2 border-pn-border-muted p-2.5">
              {providerTypes.map((providerType) => (
                <div key={providerType.id} className="flex items-center gap-2">
                  <Checkbox id={`new-provider-type-${providerType.id}`} name="providerTypeIds" value={providerType.id} />
                  <Label htmlFor={`new-provider-type-${providerType.id}`} className="flex-1 font-normal">
                    {providerType.label}
                  </Label>
                </div>
              ))}
              <div className="flex flex-col gap-1.5 pt-1.5">
                <Label>{t("providerTypePrimaryHint")}</Label>
                <RefSelect name="primaryProviderTypeId" options={providerTypes} placeholder={t("firstChecked")} />
              </div>
            </div>
            <FieldError messages={errors.providerTypeIds} />
          </div>

          <label className="flex flex-col">
            <WizardFieldLabel label={t("country")} required />
            <RefSelect name="countryId" options={countries} placeholder={t("selectACountry")} required />
            <FieldError messages={errors.countryId} />
          </label>

          <label className="flex flex-col">
            <WizardFieldLabel label={t("externalId")} />
            <Input id="externalId" name="externalId" />
            <FieldError messages={errors.externalId} />
          </label>

          <label className="col-span-full flex flex-col">
            <WizardFieldLabel label={t("profileSummary")} />
            <Textarea id="profileSummary" name="profileSummary" rows={3} />
            <FieldError messages={errors.profileSummary} />
          </label>
        </div>
      </WizardShell>
    </form>
  );
}
