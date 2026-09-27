import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatDakarDateTime } from "@/lib/formatDate";
import { localizedText } from "@/lib/localizedText";
import { staffLabel } from "@/lib/handle";
import { actionTiming, type ActionTiming } from "@/lib/caseActions";
import { listMyOpenActions } from "@/data/caseActions";
import { ColourPill } from "../_components/colour";
import { CasesTabs } from "../_components/cases-tabs";
import { setActionDoneAction } from "../actions";

const GROUPS: ActionTiming[] = ["OVERDUE", "TODAY", "UPCOMING"];

/** "My actions": every open next action you own, across all cases, grouped
 * Overdue / Today / Upcoming — a case worker's list for the day. */
export default async function MyActionsPage() {
  const t = await getTranslations("Cases");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireWorkCases(actor);

  const now = new Date();
  const actions = await listMyOpenActions(actor.id);
  const grouped = GROUPS.map((g) => ({ g, items: actions.filter((a) => actionTiming(a.dueAt, now) === g) }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-col gap-2 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <CasesTabs current="actions" myActions={actions.length} />
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {actions.length === 0 && <p className="m-0 p-8 text-center text-pn-gray-3">{t("myActionsEmpty")}</p>}
        {grouped
          .filter(({ items }) => items.length > 0)
          .map(({ g, items }) => (
            <section key={g} className="flex flex-col gap-2">
              <h2 className={`m-0 border-b-2 pb-1 text-[12px] font-bold tracking-[0.08em] uppercase ${g === "OVERDUE" ? "border-[#c62828] text-[#c62828]" : "border-pn-ink"}`}>
                {t(`actionGroup.${g}`, { count: items.length })}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {items.map((a) => (
                  <li key={a.id} className={`flex items-start gap-3 border-l-4 bg-white px-3 py-2 ${g === "OVERDUE" ? "border-[#c62828]" : "border-pn-ink"}`}>
                    <form action={setActionDoneAction} className="pt-0.5">
                      <input type="hidden" name="actionId" value={a.id} />
                      <input type="hidden" name="done" value="1" />
                      <button
                        type="submit"
                        aria-label={t("actionMarkDone", { title: a.title })}
                        title={t("actionMarkDoneShort")}
                        className="h-4.5 w-4.5 cursor-pointer border-2 border-pn-ink bg-white hover:bg-pn-surface-hover"
                      />
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold break-words">{a.title}</div>
                      <Link href={`/cases/${a.case.id}?action=${a.id}`} className="flex flex-wrap items-center gap-x-2 text-[12px] text-pn-gray-1 no-underline hover:underline">
                        <ColourPill rag={a.case.rag} label={t(`colour.${a.case.rag}`)} />
                        <span className="font-semibold">{localizedText(a.case.category.nameEn, a.case.category.nameFr, locale)}</span>
                        <span className="text-pn-gray-3 tabular-nums">{formatCaseNumber(a.case.caseNumber)}</span>
                        <span>
                          · {a.case.patient.firstName} {a.case.patient.lastName}
                        </span>
                      </Link>
                      {a.createdById !== actor.id && <div className="text-[11.5px] text-pn-gray-2">{t("actionGivenBy", { who: staffLabel(a.createdBy) })}</div>}
                    </div>
                    <div className={`text-right text-[12.5px] tabular-nums ${g === "OVERDUE" ? "font-bold text-[#c62828]" : "text-pn-gray-1"}`}>{formatDakarDateTime(a.dueAt, locale)}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
