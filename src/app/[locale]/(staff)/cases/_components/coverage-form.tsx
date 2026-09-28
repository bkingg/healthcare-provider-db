"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/validation/common";
import { setCaseCoverageAction } from "../actions";

const COVERAGES = ["COVERED", "SPECIAL_FREE", "SPECIAL_PAID"] as const;

/** Covered, or a special request (free / set cost). Someone not covered
 * can't be switched to covered. */
export function CoverageForm({ caseId, current, patientCovered }: { caseId: string; current: string; patientCovered: boolean }) {
  const t = useTranslations("Cases");
  const [value, setValue] = useState(current);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setCaseCoverageAction, null);
  const code = state && !state.success ? state.errors.coverage?.[0] : undefined;

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex items-end gap-1">
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("newCase.coverage")}
          <select name="coverage" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            {COVERAGES.map((c) => (
              <option key={c} value={c} disabled={c === "COVERED" && !patientCovered}>
                {t(`coverage.${c}`)}
              </option>
            ))}
          </select>
        </label>
        {value !== current && (
          <button type="submit" disabled={pending} className="h-8 cursor-pointer border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover disabled:opacity-40">
            {t("update")}
          </button>
        )}
      </div>
      {code && <span className="text-[11.5px] text-[#b91c1c]">{t(`newCase.error.${code}`)}</span>}
    </form>
  );
}
