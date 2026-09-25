"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateProviderWebsitesAction } from "@/app/[locale]/(staff)/providers/actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

/** Sidebar "Website" widget — Provider.websiteUrl1/2, edited in place (same
 * dark-header-bar + pencil-icon-opens-a-dialog shape as NotesWidget right
 * above it) rather than through the header's "Edit profile" dialog. Each
 * saved URL renders as a real link so "open in a new tab" is just normal
 * browser behavior. */
export function WebsiteWidget({
  providerId,
  websiteUrl1,
  websiteUrl2,
}: {
  providerId: string;
  websiteUrl1: string | null;
  websiteUrl2: string | null;
}) {
  const t = useTranslations("Profile");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateProviderWebsitesAction, null);
  const errors = state && !state.success ? state.errors : {};

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  const urls = [websiteUrl1, websiteUrl2].filter((url): url is string => Boolean(url));

  return (
    <div className="mb-4 border-2 border-pn-ink">
      <div className="flex items-center justify-between bg-pn-ink px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] text-white uppercase">
        <span>{t("websiteTitle")}</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <button type="button" aria-label={t("editWebsite")} className="cursor-pointer text-white/80 hover:text-white">
                <Pencil size={12} />
              </button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editWebsite")}</DialogTitle>
            </DialogHeader>
            <form key={`${websiteUrl1 ?? ""}|${websiteUrl2 ?? ""}`} action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={providerId} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="websiteUrl1">{t("websiteUrl1")}</Label>
                <Input id="websiteUrl1" name="websiteUrl1" type="url" placeholder="https://…" defaultValue={websiteUrl1 ?? ""} />
                <FieldError messages={errors.websiteUrl1} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="websiteUrl2">{t("websiteUrl2")}</Label>
                <Input id="websiteUrl2" name="websiteUrl2" type="url" placeholder="https://…" defaultValue={websiteUrl2 ?? ""} />
                <FieldError messages={errors.websiteUrl2} />
              </div>
              <SubmitButton className="self-start">{t("save")}</SubmitButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-3 py-2.5">
        {urls.length === 0 ? (
          <p className="m-0 text-[12.5px] text-pn-gray-3">{t("websiteEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {urls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12.5px] text-pn-accent hover:underline">
                  <ExternalLink size={12} className="flex-none" />
                  <span className="truncate">{url}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
