"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addNoteAttachmentAction, deleteNoteAttachmentAction } from "@/app/[locale]/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { StatusBadge } from "@/components/status-badge";
import { NoteVisibility } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

export function NotesSection({
  provider,
  documentCategories,
  retentionClasses,
}: {
  provider: ProviderProfile;
  documentCategories: { id: string; label: string }[];
  retentionClasses: { id: string; label: string }[];
}) {
  const t = useTranslations("Sections.Notes");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addNoteAttachmentAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTitle")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead>{t("colVisibility")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.notes.map((note) => (
              <TableRow key={note.id}>
                <TableCell>{note.title}</TableCell>
                <TableCell>{note.category.name}</TableCell>
                <TableCell>
                  <StatusBadge status={note.visibility} />
                </TableCell>
                <TableCell>
                  <InlineDeleteForm action={deleteNoteAttachmentAction} hiddenFields={{ id: note.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="providerId" value={provider.id} />
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="title">{t("formTitle")}</Label>
            <Input id="title" name="title" required />
            <FieldError messages={errors.title} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("category")}</Label>
            <RefSelect name="categoryId" options={documentCategories} required />
            <FieldError messages={errors.categoryId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("retentionClass")}</Label>
            <RefSelect name="retentionClassId" options={retentionClasses} required />
            <FieldError messages={errors.retentionClassId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("visibility")}</Label>
            <RefSelect
              name="visibility"
              options={Object.values(NoteVisibility).map((v) => ({ id: v, label: v }))}
              defaultValue={NoteVisibility.INTERNAL}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fileUrl">{t("fileUrl")}</Label>
            <Input id="fileUrl" name="fileUrl" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="body">{t("note")}</Label>
            <Textarea id="body" name="body" rows={3} />
          </div>
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("add")}</SubmitButton>
          </div>
        </form>
      </PnSection>
  );
}
