"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { uploadImportBatchAction } from "@/app/[locale]/import/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

export function UploadForm() {
  const t = useTranslations("Import");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(uploadImportBatchAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">{t("csvFile")}</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        <FieldError messages={errors.file} />
        <p className="text-xs text-muted-foreground">{t("csvFileHint")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aiPrompt">{t("aiPromptLabel")}</Label>
        <Textarea id="aiPrompt" name="aiPrompt" rows={3} placeholder={t("aiPromptPlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("aiPromptHint")}</p>
      </div>
      <SubmitButton className="self-start">{t("uploadAndValidate")}</SubmitButton>
    </form>
  );
}
