"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateProviderNotesAction } from "@/app/[locale]/providers/actions";
import { HoverTip } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

/** Sidebar "Notes" widget: the two fixed Internal/External summary notes on
 * Provider (`internalNotes`/`externalNotes`) — distinct from the freeform
 * NoteAttachment collection behind the "Notes & documents" tab. Always
 * rendered in the sidebar (outside the tab switch), above Overall rating. */
export function NotesWidget({
  providerId,
  internalNotes,
  externalNotes,
}: {
  providerId: string;
  internalNotes: string | null;
  externalNotes: string | null;
}) {
  const t = useTranslations("Profile");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateProviderNotesAction, null);

  return (
    <div className="mb-4 border-2 border-pn-ink">
      <div className="flex items-center justify-between bg-pn-ink px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] text-white uppercase">
        <span>{t("notesTitle")}</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<button type="button" aria-label={t("editNotes")} className="cursor-pointer text-white/80 hover:text-white"><Pencil size={12} /></button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editNotes")}</DialogTitle>
            </DialogHeader>
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={providerId} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="internalNotes">{t("notesInternal")}</Label>
                <Textarea id="internalNotes" name="internalNotes" rows={4} defaultValue={internalNotes ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="externalNotes">{t("notesExternal")}</Label>
                <Textarea id="externalNotes" name="externalNotes" rows={4} defaultValue={externalNotes ?? ""} />
              </div>
              <SubmitButton className="self-start">{t("save")}</SubmitButton>
              {state && !state.success && <p className="text-xs text-pn-accent">{t("notesSaveError")}</p>}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-b border-pn-rule px-3 py-2.5">
        <div className="mb-1 text-[10.5px] tracking-[0.05em] text-pn-gray-3 uppercase">{t("notesInternal")}</div>
        <HoverTip content={internalNotes}>
          <p className="m-0 line-clamp-5 text-ellipsis break-words whitespace-pre-wrap text-[12.5px] leading-tight text-pn-ink">
            {internalNotes || t("notesEmpty")}
          </p>
        </HoverTip>
      </div>
      <div className="px-3 py-2.5">
        <div className="mb-1 text-[10.5px] tracking-[0.05em] text-pn-gray-3 uppercase">{t("notesExternal")}</div>
        <HoverTip content={externalNotes}>
          <p className="m-0 line-clamp-5 text-ellipsis break-words whitespace-pre-wrap text-[12.5px] leading-tight text-pn-ink">
            {externalNotes || t("notesEmpty")}
          </p>
        </HoverTip>
      </div>
    </div>
  );
}
