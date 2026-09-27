"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Plus, RotateCcw } from "lucide-react";
import type { ActionResult } from "@/lib/validation/common";
import type { ActionTiming } from "@/lib/caseActions";
import { addCaseActionAction, setActionDoneAction } from "../actions";
import { ActionFields } from "./action-fields";
import type { Worker } from "./assignee-picker";

export type ActionItem = {
  id: string;
  title: string;
  owner: string;
  mine: boolean;
  due: string;
  timing: ActionTiming;
  done: boolean;
  /** "Done by … · when", or "Closed with the case". */
  doneNote: string | null;
};

/** A case's next actions: open ones by due time (overdue in red) with a
 * tick box each, then the done ones folded away, then "Add next action".
 * `focusId` (from a bell link) highlights one and scrolls it into view. */
export function ActionsPanel({
  caseId,
  actions,
  workers,
  meId,
  defaultOwnerId,
  focusId,
}: {
  caseId: string;
  actions: ActionItem[];
  workers: Worker[];
  meId: string;
  defaultOwnerId: string | null;
  focusId: string | null;
}) {
  const t = useTranslations("Cases");
  const open = actions.filter((a) => !a.done);
  const done = actions.filter((a) => a.done);
  const [adding, setAdding] = useState(false);
  // Bumped after each save so the next form starts empty.
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addCaseActionAction, null);
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.success) {
      setAdding(false);
      setFormKey((k) => k + 1);
    }
  }
  const errors = state && !state.success ? state.errors : {};

  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId]);

  const row = (a: ActionItem) => (
    <li
      key={a.id}
      ref={a.id === focusId ? focusRef : undefined}
      className={`flex items-start gap-2 border-l-4 bg-white px-2 py-1.5 ${a.done ? "border-pn-rule" : a.timing === "OVERDUE" ? "border-[#c62828]" : "border-pn-ink"} ${a.id === focusId ? "outline-2 outline-[#d97706]" : ""}`}
    >
      <form action={setActionDoneAction} className="pt-0.5">
        <input type="hidden" name="actionId" value={a.id} />
        <input type="hidden" name="done" value={a.done ? "0" : "1"} />
        <button
          type="submit"
          aria-label={a.done ? t("actionReopen", { title: a.title }) : t("actionMarkDone", { title: a.title })}
          title={a.done ? t("actionReopenShort") : t("actionMarkDoneShort")}
          className={`flex h-4.5 w-4.5 cursor-pointer items-center justify-center border-2 ${a.done ? "border-pn-gray-3 bg-pn-gray-3 text-white" : "border-pn-ink bg-white hover:bg-pn-surface-hover"}`}
        >
          {a.done && <Check size={11} strokeWidth={3} aria-hidden />}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] break-words ${a.done ? "text-pn-gray-3 line-through" : "font-semibold text-pn-ink"}`}>{a.title}</div>
        <div className="flex flex-wrap gap-x-2 text-[11.5px] text-pn-gray-2">
          <span className={a.mine && !a.done ? "font-semibold text-pn-gray-1" : ""}>{a.owner}</span>
          {a.done ? (
            <span>· {a.doneNote}</span>
          ) : (
            <span className={a.timing === "OVERDUE" ? "font-bold text-[#c62828]" : ""}>
              · {t(`actionTiming.${a.timing}`)} {a.due}
            </span>
          )}
        </div>
      </div>
      {a.done && <RotateCcw size={11} className="mt-1 text-pn-gray-3" aria-hidden />}
    </li>
  );

  return (
    <div className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-3">
      {open.length === 0 ? (
        <p className="m-0 text-[12.5px] text-pn-gray-3">{t("actionsEmpty")}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1 p-0">{open.map(row)}</ol>
      )}

      {done.length > 0 && (
        <details className="group" open={done.some((a) => a.id === focusId) || undefined}>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[11.5px] font-semibold text-pn-gray-2 select-none hover:text-pn-ink">
            <ChevronRight size={12} aria-hidden className="transition-transform group-open:rotate-90" />
            {t("actionsDone", { count: done.length })}
          </summary>
          <ol className="m-0 mt-1 flex list-none flex-col gap-1 p-0">{done.map(row)}</ol>
        </details>
      )}

      {adding ? (
        <form key={formKey} action={formAction} className="flex flex-col gap-2 border-t border-pn-rule pt-2">
          <input type="hidden" name="caseId" value={caseId} />
          <ActionFields workers={workers} meId={meId} defaultOwnerId={defaultOwnerId} errors={errors} />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="h-8 cursor-pointer bg-pn-ink px-3 text-xs font-semibold text-white disabled:opacity-40">
              {pending ? t("saving") : t("actionAdd")}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="cursor-pointer text-xs font-semibold text-pn-gray-2 hover:text-pn-ink">
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-7 cursor-pointer items-center gap-1 self-start border-2 border-pn-ink bg-white px-2 text-xs font-semibold hover:bg-pn-surface-hover"
        >
          <Plus size={12} aria-hidden /> {t("actionAddNext")}
        </button>
      )}
    </div>
  );
}
