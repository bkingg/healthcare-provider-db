"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addRateAction, approveRateAction, deleteRateAction } from "@/app/[locale]/(staff)/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ApprovalStatus } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

export function RatesSection({ provider, serviceTypes }: { provider: ProviderProfile; serviceTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Rates");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addRateAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colService")}</TableHead>
              <TableHead>{t("colPrice")}</TableHead>
              <TableHead>{t("colApproval")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.rates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell>{rate.serviceType.name}</TableCell>
                <TableCell>
                  {rate.price.toString()} {rate.currency}
                </TableCell>
                <TableCell>
                  <StatusBadge status={rate.approvalStatus} />
                </TableCell>
                <TableCell className="flex items-center gap-1">
                  {rate.approvalStatus !== ApprovalStatus.APPROVED && (
                    <form action={approveRateAction}>
                      <input type="hidden" name="id" value={rate.id} />
                      <input type="hidden" name="providerId" value={provider.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t("approve")}
                      </Button>
                    </form>
                  )}
                  <InlineDeleteForm action={deleteRateAction} hiddenFields={{ id: rate.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="providerId" value={provider.id} />
          <div className="flex flex-col gap-1.5">
            <Label>{t("service")}</Label>
            <RefSelect name="serviceTypeId" options={serviceTypes} required />
            <FieldError messages={errors.serviceTypeId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effectiveDate">{t("effectiveDate")}</Label>
            <Input id="effectiveDate" name="effectiveDate" type="date" required />
            <FieldError messages={errors.effectiveDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">{t("price")}</Label>
            <Input id="price" name="price" type="number" step="0.01" required />
            <FieldError messages={errors.price} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency">{t("currency")}</Label>
            <Input id="currency" name="currency" maxLength={3} placeholder="XOF" required />
            <FieldError messages={errors.currency} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discountPercent">{t("discountPercent")}</Label>
            <Input id="discountPercent" name="discountPercent" type="number" step="0.01" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">{t("source")}</Label>
            <Input id="source" name="source" />
          </div>
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("add")}</SubmitButton>
          </div>
        </form>
      </PnSection>
  );
}
