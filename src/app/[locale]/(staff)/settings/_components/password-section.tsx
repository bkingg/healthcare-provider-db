"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/app/[locale]/(staff)/change-password/_components/change-password-form";

/** The password form stays folded away until asked for, so it isn't one
 * stray click from any screen. */
export function PasswordSection() {
  const t = useTranslations("Settings");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <section className="border-2 border-pn-ink">
      <h2 className="m-0 bg-pn-ink px-4 py-2 text-[11px] font-bold tracking-[0.08em] text-white uppercase">{t("password")}</h2>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        {saved && !open && (
          <p role="status" className="m-0 text-[12.5px] font-semibold text-[#0a5c3c]">
            {t("passwordChanged")}
          </p>
        )}
        {open ? (
          <div className="flex max-w-sm flex-col gap-3">
            <ChangePasswordForm
              onSaved={() => {
                setSaved(true);
                setOpen(false);
              }}
            />
            <button type="button" onClick={() => setOpen(false)} className="cursor-pointer self-start text-xs font-semibold text-pn-gray-2 hover:text-pn-ink">
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setSaved(false);
            }}
            className="flex h-8 cursor-pointer items-center gap-1.5 self-start border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover"
          >
            <KeyRound size={13} /> {t("changePassword")}
          </button>
        )}
      </div>
    </section>
  );
}
