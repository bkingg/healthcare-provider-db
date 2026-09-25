"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateProviderRatingsAction } from "@/app/[locale]/(staff)/providers/actions";
import { useCanEdit } from "@/lib/can-edit-context";
import { StarRating } from "@/components/star-rating";
import { SubmitButton } from "@/components/submit-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/validation/common";

export type RatingCriterionText = { description: string | null; meanings: (string | null)[] };
export type RatingCriteriaText = { quality: RatingCriterionText; access: RatingCriterionText };

/** The dialog's form — its own component so the star picks start from the
 * saved ratings every time the dialog opens (the dialog content unmounts on
 * close). */
function RatingsForm({
  providerId,
  quality,
  access,
  criteria,
  onSaved,
}: {
  providerId: string;
  quality: number | null;
  access: number | null;
  criteria: RatingCriteriaText;
  onSaved: () => void;
}) {
  const t = useTranslations("Profile");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateProviderRatingsAction, null);
  const [q, setQ] = useState(quality);
  const [a, setA] = useState(access);

  // "Save" doubles as "Save & Close", like the other edit dialogs.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) onSaved();
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="qualityRating" value={q ?? ""} />
      <input type="hidden" name="accessRating" value={a ?? ""} />
      <StarRating label={t("ratingQuality")} value={q} onChange={setQ} description={criteria.quality.description} meanings={criteria.quality.meanings} />
      <StarRating label={t("ratingAccess")} value={a} onChange={setA} description={criteria.access.description} meanings={criteria.access.meanings} />
      <SubmitButton className="self-start">{t("save")}</SubmitButton>
      {state && !state.success && <p className="text-xs text-pn-accent">{t("ratingsSaveError")}</p>}
    </form>
  );
}

/** Sidebar "Ratings" widget: read-only Quality and Access stars, with a
 * pencil (same pattern as the Notes widget) that opens a dialog to change
 * them. Hovering a rating explains what it — or a given star count — means. */
export function RatingsWidget({
  providerId,
  quality,
  access,
  criteria,
}: {
  providerId: string;
  quality: number | null;
  access: number | null;
  criteria: RatingCriteriaText;
}) {
  const t = useTranslations("Profile");
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 border-2 border-pn-ink">
      <div className="flex items-center justify-between bg-pn-ink px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] text-white uppercase">
        <span>{t("ratings")}</span>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <button type="button" aria-label={t("editRatings")} className="cursor-pointer text-white/80 hover:text-white">
                  <Pencil size={12} />
                </button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("editRatings")}</DialogTitle>
              </DialogHeader>
              <RatingsForm providerId={providerId} quality={quality} access={access} criteria={criteria} onSaved={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <StarRating label={t("ratingQuality")} value={quality} description={criteria.quality.description} meanings={criteria.quality.meanings} />
        <StarRating label={t("ratingAccess")} value={access} description={criteria.access.description} meanings={criteria.access.meanings} />
      </div>
    </div>
  );
}
