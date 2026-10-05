"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Tag, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatCaseNumber } from "@/lib/caseNumber";
import { startTagging, stopTagging, useTaggingMode } from "@/lib/tagging-mode";
import { taggingContextAction } from "@/app/[locale]/(staff)/cases/actions";

/** Shown across Provider search and provider profiles while tagging
 * providers to a case. Arriving with ?tagCase=<id> (the case's "Search
 * providers" button) starts it; each page refreshes which providers are
 * already tagged. */
export function TaggingBar() {
  const t = useTranslations("Cases.tagging");
  const router = useRouter();
  const tagging = useTaggingMode();
  const fromUrl = useSearchParams().get("tagCase");
  const caseId = fromUrl ?? tagging?.caseId ?? null;

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    taggingContextAction(caseId).then((ctx) => {
      if (cancelled) return;
      if (ctx) startTagging(ctx);
      else stopTagging();
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (!tagging) return null;
  return (
    <div role="status" className="flex flex-none flex-wrap items-center justify-between gap-2 border-b-2 border-pn-ink bg-[#fff4d6] px-5 py-2 text-[12.5px]">
      <span className="flex items-center gap-2">
        <Tag size={14} aria-hidden />
        <span>
          {t("bar", { caseNumber: formatCaseNumber(tagging.caseNumber), patient: tagging.patient })}
          <span className="ml-2 text-pn-gray-2">{t("taggedCount", { count: tagging.taggedIds.length })}</span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const id = tagging.caseId;
            stopTagging();
            router.push(`/cases/${id}`);
          }}
          className="flex h-7 cursor-pointer items-center gap-1 bg-pn-ink px-2.5 text-xs font-semibold text-white"
        >
          <ArrowLeft size={12} aria-hidden /> {t("backToCase")}
        </button>
        <button type="button" onClick={stopTagging} aria-label={t("stop")} title={t("stop")} className="cursor-pointer text-pn-gray-2 hover:text-pn-ink">
          <X size={15} aria-hidden />
        </button>
      </span>
    </div>
  );
}
