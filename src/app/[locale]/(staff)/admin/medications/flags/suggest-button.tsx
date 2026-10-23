"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { suggestFlagsAction, type SuggestFlagsState } from "../../copilot/actions";

/** "Suggest flags for the next N items" — the answers land in the list
 * below for review; nothing in the catalog changes yet. */
export function SuggestFlagsButton({ batch }: { batch: number }) {
  const t = useTranslations("CopilotFlags");
  const tc = useTranslations("Copilot");
  const [state, action, pending] = useActionState<SuggestFlagsState, FormData>(() => suggestFlagsAction(), null);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <button type="submit" disabled={pending} className="flex h-8 cursor-pointer items-center gap-1.5 border-2 border-[#5b21b6] bg-white px-3 text-xs font-semibold text-[#5b21b6] hover:bg-[#f5f3ff] disabled:opacity-50">
        <Sparkles size={13} aria-hidden /> {pending ? tc("working") : t("suggest", { count: batch })}
      </button>
      {state?.ok && <span className="text-[12px] text-pn-gray-1">{state.added ? t("added", { count: state.added, remaining: state.remaining }) : t("nothingLeft")}</span>}
      {state?.ok && state.test && <span className="text-[12px] font-semibold text-[#b45309]">{tc("testNotice")}</span>}
      {state?.ok && state.warnPercent !== null && <span className="text-[12px] font-semibold text-[#b45309]">{tc("budgetWarn", { percent: Math.round(state.warnPercent) })}</span>}
      {state && !state.ok && <span className="text-[12px] font-semibold text-[#b91c1c]">{tc(`error.${state.error}`)}</span>}
    </form>
  );
}
