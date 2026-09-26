"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { ActionResult } from "@/lib/validation/common";
import { findProvidersAction } from "../actions";

export function FindProviders({ caseId, hasResults }: { caseId: string; hasResults: boolean }) {
  const t = useTranslations("Cases");
  const [state, action, pending] = useActionState<ActionResult<{ count: number; radiusKm: number }> | null, FormData>(findProvidersAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <button type="submit" disabled={pending} className="flex h-8 cursor-pointer items-center gap-1.5 border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover disabled:opacity-40">
        <Search size={13} aria-hidden /> {pending ? t("searching") : hasResults ? t("searchAgain") : t("findProviders")}
      </button>
      {state?.success && state.data && (
        <span className="text-[12px] text-pn-gray-2">{state.data.count ? t("foundWithin", { count: state.data.count, km: state.data.radiusKm }) : t("noneFound")}</span>
      )}
      {state && !state.success && <span className="text-[12px] font-semibold text-[#b91c1c]">{t(`findError.${state.errors.form?.[0] ?? "noLocation"}`)}</span>}
    </form>
  );
}
