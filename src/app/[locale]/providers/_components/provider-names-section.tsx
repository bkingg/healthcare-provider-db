"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addProviderNameAction, deleteProviderNameAction } from "@/app/[locale]/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { ProviderNameKind, ProviderNameType } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

export function ProviderNamesSection({ provider, titles }: { provider: ProviderProfile; titles: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Names");
  const tc = useTranslations("Common");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addProviderNameAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colPrimary")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.names.map((name) => (
              <TableRow key={name.id}>
                <TableCell>{name.nameType.replaceAll("_", " ")}</TableCell>
                <TableCell>{name.fullNameText}</TableCell>
                <TableCell>{name.isPrimary ? tc("yes") : ""}</TableCell>
                <TableCell>
                  <InlineDeleteForm action={deleteProviderNameAction} hiddenFields={{ id: name.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="providerId" value={provider.id} />
          {/* Not user-chosen here — mirrors the provider's own nameKind (set
              once at creation) so every name variant on this provider stays
              the same entity/individual shape. */}
          <input type="hidden" name="nameKind" value={provider.nameKind} />
          <div className="flex flex-col gap-1.5">
            <Label>{t("formType")}</Label>
            <RefSelect
              name="nameType"
              options={Object.values(ProviderNameType).map((v) => ({ id: v, label: v }))}
              defaultValue={ProviderNameType.ALIAS}
              required
            />
          </div>
          {provider.nameKind === ProviderNameKind.ENTITY ? (
            <div className="flex flex-1 min-w-48 flex-col gap-1.5">
              <Label htmlFor="facilityName">{t("formName")}</Label>
              <Input id="facilityName" name="facilityName" required />
              <FieldError messages={errors.facilityName} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("formPrefix")}</Label>
                <RefSelect name="individualTitleId" options={titles} placeholder={t("formPrefixPlaceholder")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="individualFirstName">{t("formFirstName")}</Label>
                <Input id="individualFirstName" name="individualFirstName" required />
                <FieldError messages={errors.individualFirstName} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="individualLastName">{t("formLastName")}</Label>
                <Input id="individualLastName" name="individualLastName" required />
                <FieldError messages={errors.individualLastName} />
              </div>
            </>
          )}
          <div className="flex items-center gap-2 pb-2">
            <Checkbox id="isPrimary" name="isPrimary" />
            <Label htmlFor="isPrimary">{t("formPrimary")}</Label>
          </div>
          <SubmitButton variant="outline">{t("add")}</SubmitButton>
        </form>
      </PnSection>
  );
}
