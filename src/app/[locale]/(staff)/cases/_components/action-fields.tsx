"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { quickDueTimes, toDueInput } from "@/lib/caseActions";
import { AssigneePicker, type Worker } from "./assignee-picker";

/** A next action's fields — what, who (a case worker, by name or @handle)
 * and when (required; Dakar time, with quick picks). Submitted as
 * actionTitle / actionOwnerId / actionDue, inside whichever form holds them.
 * `errors` are the server's codes for these fields (Cases.actionError.*). */
export function ActionFields({
  workers,
  meId,
  defaultOwnerId,
  errors = {},
  tone = "neutral",
}: {
  workers: Worker[];
  meId: string;
  defaultOwnerId: string | null;
  errors?: Record<string, string[] | undefined>;
  tone?: "neutral" | "note";
}) {
  const t = useTranslations("Cases");
  // Picked once when the fields appear; "in 1 hour" doesn't need to tick.
  const [now] = useState(() => new Date());
  // Controlled, so a failed save doesn't wipe what was typed.
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const border = tone === "note" ? "border-[#e8c98a] focus:border-[#b45309]" : "border-pn-border-muted focus:border-pn-ink";
  const error = (field: string) => {
    const code = errors[field]?.[0];
    return code ? <p className="m-0 text-[11.5px] font-normal tracking-normal text-[#b91c1c] normal-case">{t(`actionError.${code}`)}</p> : null;
  };
  const labelClass = "flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase";

  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>
        {t("actionWhat")}
        <input
          name="actionTitle"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("actionWhatPlaceholder")}
          className={`h-8 border-2 bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case outline-none ${border}`}
        />
        {error("actionTitle")}
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <div className={labelClass}>
          <span aria-hidden>{t("actionWho")}</span>
          <AssigneePicker workers={workers} defaultId={defaultOwnerId ?? meId} meId={meId} name="actionOwnerId" allowNone={false} label={t("actionWho")} widthClass="w-[230px]" />
          {error("actionOwnerId")}
        </div>
        <label className={labelClass}>
          {t("actionWhen")}
          <input
            type="datetime-local"
            name="actionDue"
            required
            value={due}
            min={toDueInput(now)}
            onChange={(e) => setDue(e.target.value)}
            className={`h-8 border-2 bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case outline-none ${border}`}
          />
          {error("actionDue")}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <span className="text-pn-gray-2">{t("actionQuick")}</span>
        {quickDueTimes(now).map((q) => {
          const value = toDueInput(q.at);
          return (
            <button
              key={q.key}
              type="button"
              aria-pressed={due === value}
              onClick={() => setDue(value)}
              className={`cursor-pointer border px-1.5 py-0.5 font-semibold ${due === value ? "border-pn-ink bg-pn-ink text-white" : "border-pn-border-muted bg-white text-pn-gray-1 hover:border-pn-ink"}`}
            >
              {t(`actionQuickPick.${q.key}`)}
            </button>
          );
        })}
        <span className="text-pn-gray-3">{t("dakarTime")}</span>
      </div>
    </div>
  );
}
