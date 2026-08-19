"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { commitImportBatchAction } from "@/app/[locale]/import/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

export type DuplicateCandidate = {
  stagingRowName: string;
  existingProviderId: string;
  existingProviderName: string;
};

/**
 * The one gate before staged rows become real Provider records. Deliberately
 * a confirm-then-submit dialog (matching ResolveDialog's shape) rather than
 * the bare one-click button this replaced — this is also where the future
 * AI-assisted scrub/dedupe/standardize tool's output will land once it's
 * connected (see ImportBatch.aiPrompt); for now that section is a labeled
 * placeholder and the admin reviews the existing validation + duplicate
 * results directly.
 */
export function ConfirmImportDialog({
  batchId,
  validatedCount,
  aiPrompt,
  duplicates,
}: {
  batchId: string;
  validatedCount: number;
  aiPrompt: string | null;
  duplicates: DuplicateCandidate[];
}) {
  const t = useTranslations("Import");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(commitImportBatchAction, null);
  const errors = state && !state.success ? state.errors : {};

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="self-start">{t("reviewAndConfirm")}</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("confirmTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("validatedReady", { count: validatedCount })}</p>

          {aiPrompt && (
            <div className="flex flex-col gap-1">
              <Label>{t("aiInstructionsLabel")}</Label>
              <p className="rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{aiPrompt}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">{t("aiReviewTitle")}</span>
              <Badge variant="secondary">{t("aiReviewComingSoon")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t("aiReviewPlaceholder")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("potentialDuplicates", { count: duplicates.length })}</Label>
            {duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noDuplicates")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {duplicates.map((d, i) => (
                  <li key={i}>
                    {t("duplicateOf", { name: d.stagingRowName })}{" "}
                    <Link href={`/providers/${d.existingProviderId}`} className="hover:underline" target="_blank">
                      {d.existingProviderName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={formAction} className="flex flex-col gap-3 border-t pt-4">
            <input type="hidden" name="id" value={batchId} />
            <div className="flex items-start gap-2">
              <Checkbox id="confirmed" name="confirmed" required className="mt-0.5" />
              <Label htmlFor="confirmed" className="text-sm font-normal">
                {t("confirmCheckboxLabel")}
              </Label>
            </div>
            <FieldError messages={errors.id} />
            <div className="flex gap-2">
              <SubmitButton>{t("commit", { count: validatedCount })}</SubmitButton>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
