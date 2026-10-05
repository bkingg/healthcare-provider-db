"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Tag } from "lucide-react";
import { localizedText } from "@/lib/localizedText";
import { DoNotUseFlag, isDoNotUse } from "@/components/do-not-use-flag";
import { PnTag } from "@/components/pn-tag";
import { findProviderForTagAction, tagProviderAction } from "../actions";

type Preview = NonNullable<Awaited<ReturnType<typeof findProviderForTagAction>>>;

/** "Tag by ID": type NMD-000012 (or 12), check the preview, then tag. */
export function TagById({ caseId, taggedIds }: { caseId: string; taggedIds: string[] }) {
  const t = useTranslations("Cases.tagging");
  const locale = useLocale();
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  function look() {
    if (!value.trim()) return;
    setBusy(true);
    findProviderForTagAction(value)
      .then((p) => {
        setPreview(p);
        setNotFound(!p);
      })
      .finally(() => setBusy(false));
  }

  const already = preview ? taggedIds.includes(preview.id) : false;
  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          look();
        }}
        className="flex items-end gap-1"
      >
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("byId")}
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setPreview(null);
              setNotFound(false);
            }}
            placeholder="NMD-000012"
            autoComplete="off"
            className="h-8 w-[160px] border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case outline-none focus:border-pn-ink"
          />
        </label>
        <button type="submit" disabled={busy || !value.trim()} className="h-8 cursor-pointer border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover disabled:opacity-40">
          {t("find")}
        </button>
      </form>
      {notFound && <p className="m-0 text-[12px] font-semibold text-[#b91c1c]">{t("notFound")}</p>}
      {preview && (
        <div className={`flex flex-wrap items-center justify-between gap-2 border-2 px-3 py-2 ${isDoNotUse(preview.status) ? "border-[#c62828] bg-[#fdecec]" : "border-pn-ink bg-white"}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              <DoNotUseFlag status={preview.status} />
              {preview.name} <span className="font-normal text-pn-gray-3 tabular-nums">{preview.code}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-pn-gray-2">
              {[localizedText(preview.typeEn, preview.typeFr, locale), preview.city].filter(Boolean).join(" · ")}
              <PnTag status={preview.status} />
            </div>
            {isDoNotUse(preview.status) && <p className="m-0 mt-1 text-[12px] font-semibold text-[#991b1b]">{t("doNotUseWarning")}</p>}
          </div>
          {already ? (
            <span className="text-[12px] font-semibold text-[#0a5c3c]">{t("alreadyTagged")}</span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                tagProviderAction(caseId, preview.id)
                  .then(() => {
                    setValue("");
                    setPreview(null);
                  })
                  .finally(() => setBusy(false));
              }}
              className="flex h-8 cursor-pointer items-center gap-1 bg-pn-ink px-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Tag size={12} aria-hidden /> {t("tagToCase")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
