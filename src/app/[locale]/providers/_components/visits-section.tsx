"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addProviderVisitAction, deleteProviderVisitAction } from "@/app/[locale]/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

export function VisitsSection({ provider, users }: { provider: ProviderProfile; users: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Visits");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addProviderVisitAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colDate")}</TableHead>
              <TableHead>{t("colReviewer")}</TableHead>
              <TableHead>{t("colFindings")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.visits.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell>{new Date(visit.visitDate).toLocaleDateString()}</TableCell>
                <TableCell>{visit.reviewedBy.name ?? visit.reviewedBy.email}</TableCell>
                <TableCell className="max-w-xs truncate">{visit.findings}</TableCell>
                <TableCell>
                  <InlineDeleteForm action={deleteProviderVisitAction} hiddenFields={{ id: visit.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="providerId" value={provider.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visitDate">{t("visitDate")}</Label>
            <Input id="visitDate" name="visitDate" type="date" required />
            <FieldError messages={errors.visitDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("reviewer")}</Label>
            <RefSelect name="reviewedById" options={users} required />
            <FieldError messages={errors.reviewedById} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="findings">{t("findings")}</Label>
            <Textarea id="findings" name="findings" rows={2} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="actionItems">{t("actionItems")}</Label>
            <Textarea id="actionItems" name="actionItems" rows={2} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="documentUrlsRaw">{t("documentUrls")}</Label>
            <Textarea id="documentUrlsRaw" name="documentUrlsRaw" rows={2} />
          </div>
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("add")}</SubmitButton>
          </div>
        </form>
      </PnSection>
  );
}
