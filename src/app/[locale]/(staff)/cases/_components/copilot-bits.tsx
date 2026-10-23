"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { dismissCopilotAction, saveSummaryAsNoteAction, summarizeCaseAction, type CopilotResult } from "../copilot-actions";

/** Shared bits of the copilot on the case page: the "check it" notice under
 * an answer, and the case summary. */

export function CopilotNotice({ test, warnPercent, kind }: { test: boolean; warnPercent: number | null; kind: "draft" | "summary" }) {
  const t = useTranslations("Copilot");
  return (
    <div className="flex flex-col gap-0.5 text-[11.5px]">
      <span className="flex items-center gap-1 font-semibold text-[#5b21b6]">
        <Sparkles size={12} aria-hidden /> {t(kind === "draft" ? "draftNotice" : "summaryNotice")}
      </span>
      {test && <span className="font-semibold text-[#b45309]">{t("testNotice")}</span>}
      {warnPercent !== null && <span className="font-semibold text-[#b45309]">{t("budgetWarn", { percent: Math.round(warnPercent) })}</span>}
    </div>
  );
}

export function copilotError(t: ReturnType<typeof useTranslations>, r: CopilotResult) {
  return r.ok ? null : t(`error.${r.error}`);
}

/** "Summarise" on the request panel: a short summary to read, which can be
 * kept as an internal note. */
export function CaseSummary({ caseId }: { caseId: string }) {
  const t = useTranslations("Copilot");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [saved, setSaved] = useState(false);

  const ask = () =>
    start(async () => {
      if (result?.ok && !saved) void dismissCopilotAction(result.usageId);
      setSaved(false);
      setResult(await summarizeCaseAction(caseId));
    });
  const close = () => {
    if (result?.ok && !saved) void dismissCopilotAction(result.usageId);
    setResult(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={ask}
        disabled={pending}
        className="flex h-7 cursor-pointer items-center gap-1.5 self-start border-2 border-[#5b21b6] bg-white px-2.5 text-[12px] font-semibold text-[#5b21b6] hover:bg-[#f5f3ff] disabled:opacity-50"
      >
        <Sparkles size={13} aria-hidden /> {pending ? t("working") : result?.ok ? t("summariseAgain") : t("summarise")}
      </button>
      {result && !result.ok && <p className="m-0 text-[12px] font-semibold text-[#b91c1c]">{copilotError(t, result)}</p>}
      {result?.ok && (
        <div className="relative flex flex-col gap-2 border-2 border-[#c4b5fd] bg-[#faf8ff] p-3 pr-9">
          <button type="button" onClick={close} aria-label={t("close")} title={t("close")} className="absolute top-1.5 right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center text-pn-gray-2 hover:text-pn-ink">
            <X size={15} aria-hidden />
          </button>
          <CopilotNotice kind="summary" test={result.test} warnPercent={result.budget.warn ? result.budget.percent : null} />
          <p className="m-0 text-[13px] whitespace-pre-line">{result.text}</p>
          {saved ? (
            <p className="m-0 text-[12px] font-semibold text-[#0a5c3c]">{t("savedAsNote")}</p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await saveSummaryAsNoteAction(result.usageId, caseId, result.text);
                  setSaved(true);
                })
              }
              className="h-7 cursor-pointer self-start bg-[#b45309] px-2.5 text-[12px] font-semibold text-white hover:bg-[#92400e] disabled:opacity-50"
            >
              {t("saveAsNote")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
