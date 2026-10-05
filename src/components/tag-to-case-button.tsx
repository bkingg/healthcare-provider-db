"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Tag } from "lucide-react";
import { markTagged, useTaggingMode } from "@/lib/tagging-mode";
import { tagProviderAction } from "@/app/[locale]/(staff)/cases/actions";

/** "Tag to case" on a Provider search row (icon only, so it doesn't squeeze
 * the name) or a profile (with its label) — only while tagging mode is on
 * (see TaggingBar). Doesn't open the row it sits in. */
export function TagToCaseButton({ providerId, size = "sm" }: { providerId: string; size?: "sm" | "md" }) {
  const t = useTranslations("Cases.tagging");
  const tagging = useTaggingMode();
  const [pending, setPending] = useState(false);
  if (!tagging) return null;
  const tagged = tagging.taggedIds.includes(providerId);
  const md = size === "md";
  const base = md ? "h-8 px-3 text-xs" : "h-6 w-6 justify-center";
  if (tagged) {
    return (
      <span title={t("tagged")} className={`flex flex-none items-center gap-1 border-2 border-pn-accent bg-pn-accent-soft font-semibold text-[#0a5c3c] ${base}`}>
        <Check size={12} aria-hidden /> {md ? t("tagged") : <span className="sr-only">{t("tagged")}</span>}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("tagToCase")}
      title={t("tagToCase")}
      onClick={(e) => {
        e.stopPropagation();
        setPending(true);
        tagProviderAction(tagging.caseId, providerId)
          .then(() => markTagged(providerId))
          .finally(() => setPending(false));
      }}
      className={`flex flex-none cursor-pointer items-center gap-1 border-2 border-pn-ink bg-white font-semibold hover:bg-pn-surface-hover disabled:opacity-40 ${base}`}
    >
      <Tag size={12} aria-hidden /> {md ? (pending ? t("tagging") : t("tagToCase")) : null}
    </button>
  );
}
