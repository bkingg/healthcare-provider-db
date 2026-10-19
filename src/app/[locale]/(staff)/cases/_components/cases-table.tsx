"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, MessageSquareReply } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CHECKLIST_FOOTER_BUTTON, ChecklistMenu } from "@/components/checklist-menu";
import { isDefaultSort, nextSort, type CaseSort } from "@/lib/caseListSort";
import { COLOUR_STYLE, ColourPill, type Colour } from "./colour";
import { ChannelIcon, CoverageTag } from "./channel-icon";
import { CASE_COLUMN_WIDTH, isLockedCaseColumn, useCaseColumns, type CaseColumnKey } from "./case-columns";

/** One case, already worded for display (the page works out labels and
 * times on the server). */
export type CaseRow = {
  id: string;
  rag: Colour;
  ragLabel: string;
  caseNumber: string;
  type: string;
  reasons: string[];
  replied: boolean;
  channel: string;
  channelLabel: string;
  coverage: string;
  coverageLabel: string;
  patient: string;
  patientAge: string | null;
  /** Only when someone else asked for the patient. */
  requestedBy: string | null;
  memberId: string | null;
  statusLabel: string;
  assigned: string | null;
  nextAction: { text: string; title: string; overdue: boolean } | null;
  /** No next action on an open case — worth a nudge. */
  needsNextAction: boolean;
  due: { text: string; overdue: boolean } | null;
  waiting: string;
  created: string;
  urgencyLabel: string;
  location: string | null;
  phone: string;
};

/** The case list as a table: every column sorts (click its header; again
 * to reverse), and the Columns menu shows, hides and reorders them —
 * saved in this browser. */
export function CasesTable({ rows, sort }: { rows: CaseRow[]; sort: CaseSort }) {
  const t = useTranslations("Cases");
  const params = useSearchParams();
  const { shown, order, columns, toggle, move, reset } = useCaseColumns();
  const template = columns.map((k) => CASE_COLUMN_WIDTH[k]).join(" ");
  // Row padding + gaps + each column's fixed or minimum width: past that the
  // table scrolls sideways instead of squeezing columns.
  const minWidth = 44 + 12 * (columns.length - 1) + columns.reduce((n, k) => n + parseInt(CASE_COLUMN_WIDTH[k].replace(/^minmax\(/, ""), 10), 0);

  const sortHref = (key: CaseColumnKey) => {
    const next = nextSort(sort, key);
    const p = new URLSearchParams(params.toString());
    if (isDefaultSort(next)) {
      p.delete("sort");
      p.delete("dir");
    } else {
      p.set("sort", next.key);
      p.set("dir", next.dir);
    }
    const qs = p.toString();
    return qs ? `/cases?${qs}` : "/cases";
  };

  const cell = (r: CaseRow, k: CaseColumnKey) => {
    switch (k) {
      case "priority":
        return <ColourPill rag={r.rag} label={r.ragLabel} />;
      case "caseNumber":
        return <span className="text-pn-gray-1 tabular-nums">{r.caseNumber}</span>;
      case "type":
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-bold">{r.type}</span>
              <ChannelIcon channel={r.channel} label={r.channelLabel} size={12} />
              <CoverageTag coverage={r.coverage} label={r.coverageLabel} />
            </span>
            {(r.reasons.length > 0 || r.replied) && (
              <span className="flex flex-wrap gap-1">
                {r.reasons.map((x) => (
                  <span key={x} className="bg-pn-panel px-1.5 text-[11px] text-pn-gray-1">
                    {x}
                  </span>
                ))}
                {r.replied && (
                  <span className="flex items-center gap-1 bg-[#e0ecff] px-1.5 text-[11px] font-semibold text-[#1d4ed8]">
                    <MessageSquareReply size={11} aria-hidden /> {t("memberReplied")}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      case "patient":
        return (
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {r.patient}
              {r.patientAge && <span className="font-normal text-pn-gray-2"> · {r.patientAge}</span>}
            </div>
            {r.requestedBy && !shown.has("requestedBy") && <div className="truncate text-[12px] text-pn-gray-2">{t("requestedBy", { name: r.requestedBy })}</div>}
          </div>
        );
      case "requestedBy":
        return (
          <span className="block truncate" title={r.requestedBy ?? undefined}>
            {r.requestedBy ?? <span className="text-pn-gray-3">{t("columns.samePerson")}</span>}
          </span>
        );
      case "memberId":
        return <span className="tabular-nums">{r.memberId ?? "—"}</span>;
      case "status":
        return <span className="text-pn-gray-1">{r.statusLabel}</span>;
      case "assigned":
        return (
          <span className={`block truncate ${r.assigned ? "" : "text-pn-gray-3"}`} title={r.assigned ?? undefined}>
            {r.assigned ?? t("unassigned")}
          </span>
        );
      case "nextAction":
        return r.nextAction ? (
          <span className={`line-clamp-2 text-[12px] ${r.nextAction.overdue ? "font-bold text-[#c62828]" : "text-pn-gray-1"}`} title={r.nextAction.title}>
            {r.nextAction.text}
          </span>
        ) : r.needsNextAction ? (
          <span className="text-[12px] text-pn-gray-3 italic">{t("noNextAction")}</span>
        ) : (
          <span className="text-pn-gray-3">—</span>
        );
      case "due":
        return r.due ? <span className={`whitespace-nowrap tabular-nums ${r.due.overdue ? "font-bold text-[#c62828]" : "text-pn-gray-1"}`}>{r.due.text}</span> : <span className="text-pn-gray-3">—</span>;
      case "waiting":
        return <span className="text-pn-gray-1 tabular-nums">{r.waiting}</span>;
      case "created":
        return <span className="text-pn-gray-1 tabular-nums">{r.created}</span>;
      case "channel":
        return (
          <span className="flex items-center gap-1.5 text-pn-gray-1">
            <ChannelIcon channel={r.channel} label={r.channelLabel} size={12} /> {r.channelLabel}
          </span>
        );
      case "coverage":
        return <span className="text-pn-gray-1">{r.coverageLabel}</span>;
      case "urgency":
        return <span className="text-pn-gray-1">{r.urgencyLabel}</span>;
      case "location":
        return (
          <span className="block truncate text-pn-gray-1" title={r.location ?? undefined}>
            {r.location ?? "—"}
          </span>
        );
      case "phone":
        return <span className="text-pn-gray-1 tabular-nums">{r.phone}</span>;
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-end px-5 pb-2">
        <ChecklistMenu
          idPrefix="casecol"
          button={
            <>
              <Columns3 size={14} /> {t("columns.button")}
            </>
          }
          buttonClassName="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
          items={order.map((k) => ({ key: k, label: t(`columns.${k}`), checked: shown.has(k), locked: isLockedCaseColumn(k) }))}
          onToggle={(k) => toggle(k as CaseColumnKey)}
          onMove={(k, i) => move(k as CaseColumnKey, i)}
          footer={
            <button type="button" onClick={reset} className={CHECKLIST_FOOTER_BUTTON}>
              {t("columns.reset")}
            </button>
          }
        />
      </div>
      <div className="overflow-x-auto border-t border-pn-rule">
        <div role="table" aria-label={t("title")} style={{ minWidth }}>
          <div role="row" className="grid items-end gap-x-3 border-b-2 border-pn-ink bg-pn-panel py-2 pr-5 pl-6" style={{ gridTemplateColumns: template }}>
            {columns.map((k) => {
              const active = sort.key === k;
              const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <span key={k} role="columnheader" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <Link
                    href={sortHref(k)}
                    scroll={false}
                    title={t("columns.sortBy", { column: t(`columns.${k}`) })}
                    className={`flex items-center gap-1 text-[10.5px] font-bold tracking-[0.06em] uppercase no-underline hover:text-pn-ink ${active ? "text-pn-ink" : "text-pn-gray-2"}`}
                  >
                    {t(`columns.${k}`)}
                    <Icon size={11} className={active ? "" : "opacity-40"} aria-hidden />
                  </Link>
                </span>
              );
            })}
          </div>
          {rows.map((r) => (
            <div key={r.id} role="row" className="relative border-b border-pn-rule bg-white hover:bg-pn-surface-hover">
              <span className={`absolute inset-y-0 left-0 w-1.5 ${COLOUR_STYLE[r.rag].stripe}`} aria-hidden />
              <Link href={`/cases/${r.id}`} className="grid items-center gap-x-3 py-2.5 pr-5 pl-6 text-[13px] text-pn-ink no-underline" style={{ gridTemplateColumns: template }}>
                {columns.map((k) => (
                  <span key={k} role="cell" className="min-w-0">
                    {cell(r, k)}
                  </span>
                ))}
              </Link>
            </div>
          ))}
          {rows.length === 0 && <div className="p-8 text-center text-pn-gray-3">{t("empty")}</div>}
        </div>
      </div>
    </div>
  );
}
