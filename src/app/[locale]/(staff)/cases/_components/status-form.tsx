"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setCaseStatusAction } from "../actions";

const STATUSES = ["NEW", "IN_PROGRESS", "WAITING_MEMBER", "RESOLVED", "CLOSED"] as const;

/** The case's status picker. Resolving or closing a case that still has open
 * next actions asks first whether to close those too — they're never lost
 * without anyone noticing; "not now" leaves the status as it was. */
export function StatusForm({ caseId, current, openActions }: { caseId: string; current: string; openActions: number }) {
  const t = useTranslations("Cases");
  const [status, setStatus] = useState(current);
  const [asking, setAsking] = useState(false);
  const closing = (status === "RESOLVED" || status === "CLOSED") && status !== current;

  return (
    <form
      action={setCaseStatusAction}
      onSubmit={(e) => {
        if (closing && openActions > 0 && !asking) {
          e.preventDefault();
          setAsking(true);
        }
      }}
      className="flex flex-col gap-1.5"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex items-end gap-1">
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("statusLabel")}
          <select
            name="status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setAsking(false);
            }}
            className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {!asking && (
          <button type="submit" className="h-8 cursor-pointer border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover">
            {t("update")}
          </button>
        )}
      </div>
      {asking && (
        <div role="alertdialog" aria-label={t("closeActionsQuestion", { count: openActions })} className="flex flex-wrap items-center gap-2 border-l-4 border-pn-ink bg-pn-panel px-2 py-1.5 text-[12.5px]">
          <span className="font-semibold">{t("closeActionsQuestion", { count: openActions })}</span>
          <button type="submit" name="closeOpenActions" value="1" className="cursor-pointer bg-pn-ink px-2 py-1 text-xs font-semibold text-white">
            {t("closeActionsYes", { status: t(`status.${status}`) })}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="cursor-pointer border border-pn-ink bg-white px-2 py-1 text-xs font-semibold">
            {t("closeActionsNo")}
          </button>
        </div>
      )}
    </form>
  );
}
