"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Palette } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/validation/common";
import { overrideColourAction } from "../actions";

/** Staff can set the colour by hand; the reason is required and goes into
 * the timeline. */
export function ColourOverride({ caseId, current }: { caseId: string; current: string }) {
  const t = useTranslations("Cases");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(overrideColourAction, null);
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.success) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="flex h-8 cursor-pointer items-center gap-1.5 border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover">
            <Palette size={13} aria-hidden /> {t("changeColour")}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changeColour")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div role="radiogroup" aria-label={t("changeColour")} className="flex gap-2">
            {(["RED", "YELLOW", "GREEN"] as const).map((rag) => (
              <label key={rag} className="flex flex-1 cursor-pointer items-center gap-2 border-2 border-pn-border-muted px-3 py-2 text-[13px] font-semibold has-[:checked]:border-pn-ink">
                <input type="radio" name="rag" value={rag} defaultChecked={rag === current} required />
                {t(`colour.${rag}`)}
              </label>
            ))}
          </div>
          <label htmlFor="reason" className="text-[12px] font-semibold">
            {t("overrideReason")}
          </label>
          <textarea id="reason" name="reason" rows={3} required spellCheck autoCapitalize="sentences" className="border-2 border-pn-border-muted p-2 text-[13px] outline-none focus:border-pn-ink" />
          {state && !state.success && <p className="m-0 text-[12px] text-[#b91c1c]">{Object.values(state.errors)[0]?.[0]}</p>}
          <button type="submit" disabled={pending} className="h-8 cursor-pointer self-start bg-pn-ink px-3 text-xs font-semibold text-white disabled:opacity-40">
            {t("saveColour")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
