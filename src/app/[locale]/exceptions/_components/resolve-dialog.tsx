"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { resolveExceptionAction } from "@/app/[locale]/exceptions/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { DqResolution } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";

export function ResolveDialog({ exceptionId }: { exceptionId: string }) {
  const t = useTranslations("Exceptions");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(resolveExceptionAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">{t("resolve")}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("resolveTitle")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={exceptionId} />
          <div className="flex flex-col gap-1.5">
            <Label>{t("decision")}</Label>
            <RefSelect
              name="resolutionDecision"
              options={Object.values(DqResolution).map((v) => ({ id: v, label: v }))}
              required
            />
            <FieldError messages={errors.resolutionDecision} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolutionNotes">{t("notes")}</Label>
            <Textarea id="resolutionNotes" name="resolutionNotes" rows={3} />
          </div>
          <SubmitButton className="self-start">{t("save")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
