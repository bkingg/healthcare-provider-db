"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addCredentialAction, deleteCredentialAction } from "@/app/[locale]/(staff)/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

export function CredentialsSection({
  provider,
  credentialTypes,
  credentialStatuses,
}: {
  provider: ProviderProfile;
  credentialTypes: { id: string; label: string }[];
  credentialStatuses: { id: string; label: string }[];
}) {
  const t = useTranslations("Sections.Credentials");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addCredentialAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colExpires")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.credentials.map((credential) => (
              <TableRow key={credential.id}>
                <TableCell>{credential.credentialType.name}</TableCell>
                <TableCell>{credential.status.name}</TableCell>
                <TableCell>{credential.expirationDate ? new Date(credential.expirationDate).toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <InlineDeleteForm action={deleteCredentialAction} hiddenFields={{ id: credential.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="providerId" value={provider.id} />
          <div className="flex flex-col gap-1.5">
            <Label>{t("formType")}</Label>
            <RefSelect name="credentialTypeId" options={credentialTypes} required />
            <FieldError messages={errors.credentialTypeId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("formStatus")}</Label>
            <RefSelect name="statusId" options={credentialStatuses} required />
            <FieldError messages={errors.statusId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issuedDate">{t("issued")}</Label>
            <Input id="issuedDate" name="issuedDate" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expirationDate">{t("expires")}</Label>
            <Input id="expirationDate" name="expirationDate" type="date" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="documentUrl">{t("documentUrl")}</Label>
            <Input id="documentUrl" name="documentUrl" />
          </div>
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("add")}</SubmitButton>
          </div>
        </form>
      </PnSection>
  );
}
