import { getLocale, getTranslations } from "next-intl/server";
import { Clock, MessageSquareReply } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { isOfficeHours } from "@/lib/businessHours";
import { formatCaseNumber } from "@/lib/caseNumber";
import { shortDuration } from "@/lib/caseTime";
import { ageFromDateOfBirth } from "@/lib/memberNumber";
import { localizedText } from "@/lib/localizedText";
import { caseQueue, queueCounts, refreshOverdueCases, type QueueFilters } from "@/data/caseOps";
import { COLOUR_STYLE, ColourPill, type Colour } from "./_components/colour";

function parseFilters(raw: Record<string, string | string[] | undefined>): QueueFilters {
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const q = one("q")?.trim() || undefined;
  const colour = one("colour");
  const status = one("status");
  const assigned = one("assigned");
  return {
    q,
    colour: colour === "RED" || colour === "YELLOW" || colour === "GREEN" ? colour : undefined,
    // Searching (the header search box) looks across every status — you're
    // usually after one specific case — unless a status was picked.
    status: status && ["NEW", "IN_PROGRESS", "WAITING_MEMBER", "RESOLVED", "CLOSED", "ALL"].includes(status) ? (status as QueueFilters["status"]) : q ? "ALL" : "OPEN",
    assigned: assigned === "ME" || assigned === "UNASSIGNED" ? assigned : "ANY",
  };
}

export default async function CasesPage(props: PageProps<"/[locale]/cases">) {
  const t = await getTranslations("Cases");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireWorkCases(actor);

  // Overdue cases move up a colour whenever staff look — no background job.
  await refreshOverdueCases();
  const filters = parseFilters(await props.searchParams);
  const now = new Date();
  const [cases, counts] = await Promise.all([caseQueue(filters, actor.id), queueCounts(now)]);
  const inOffice = isOfficeHours(now);

  // Links that change the colour keep the current search.
  const queueHref = (extra: { colour?: Colour }) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (extra.colour) params.set("colour", extra.colour);
    const qs = params.toString();
    return qs ? `/cases?${qs}` : "/cases";
  };

  const tile = (colour: Colour | "OVERDUE", count: number) => {
    const active = colour === "OVERDUE" ? false : filters.colour === colour;
    const href = colour === "OVERDUE" ? queueHref({}) : queueHref({ colour });
    return (
      <Link
        href={active ? queueHref({}) : href}
        className={`flex min-w-[120px] flex-1 flex-col gap-0.5 border-2 px-4 py-3 no-underline ${active ? "border-pn-ink" : "border-pn-rule"} ${colour === "OVERDUE" ? "bg-white" : COLOUR_STYLE[colour].soft}`}
      >
        <span className="text-[11px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase">{t(`tile.${colour}`)}</span>
        <span className="text-[28px] leading-none font-extrabold text-pn-ink tabular-nums">{count}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-wrap items-end justify-between gap-3 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
          {filters.q && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
              <span>
                <strong className="tabular-nums">{cases.length}</strong> {t("searchResults", { count: cases.length, q: filters.q })}
              </span>
              <Link href={filters.colour ? `/cases?colour=${filters.colour}` : "/cases"} className="font-semibold text-[#0a5c3c]">
                {t("clearSearch")}
              </Link>
            </div>
          )}
          <div className={`mt-1 flex items-center gap-1.5 text-[12px] font-semibold ${inOffice ? "text-pn-gray-2" : "text-[#b45309]"}`}>
            <Clock size={13} aria-hidden /> {inOffice ? t("officeHours") : t("onCall")}
          </div>
        </div>
      </div>

      <div className="flex flex-none flex-wrap gap-2 px-5 pt-4">
        {tile("RED", counts.RED)}
        {tile("YELLOW", counts.YELLOW)}
        {tile("GREEN", counts.GREEN)}
        {tile("OVERDUE", counts.overdue)}
      </div>

      <form method="get" className="flex flex-none flex-wrap items-end gap-2 px-5 py-3">
        {filters.colour && <input type="hidden" name="colour" value={filters.colour} />}
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("statusLabel")}
          <select name="status" defaultValue={filters.status} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            <option value="OPEN">{t("statusFilter.OPEN")}</option>
            {["NEW", "IN_PROGRESS", "WAITING_MEMBER", "RESOLVED", "CLOSED", "ALL"].map((s) => (
              <option key={s} value={s}>
                {t(`statusFilter.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("assigned")}
          <select name="assigned" defaultValue={filters.assigned} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            <option value="ANY">{t("assignedFilter.ANY")}</option>
            <option value="ME">{t("assignedFilter.ME")}</option>
            <option value="UNASSIGNED">{t("assignedFilter.UNASSIGNED")}</option>
          </select>
        </label>
        <button type="submit" className="h-8 cursor-pointer border-2 border-pn-ink bg-pn-ink px-4 text-xs font-semibold text-white">
          {t("apply")}
        </button>
        {filters.colour && (
          <Link href={queueHref({})} className="h-8 content-center text-[12px] font-semibold text-[#0a5c3c]">
            {t("showAllColours")}
          </Link>
        )}
      </form>

      <ul className="m-0 flex list-none flex-col gap-0 border-t border-pn-rule p-0">
        {cases.map((c) => {
          const due = c.responseDueAt;
          const overdue = due !== null && due < now && ["NEW", "IN_PROGRESS"].includes(c.status);
          const replied = c.events[0]?.type === "MESSAGE_FROM_MEMBER";
          const age = ageFromDateOfBirth(c.patient.dateOfBirth);
          return (
            <li key={c.id} className="relative border-b border-pn-rule bg-white hover:bg-pn-surface-hover">
              <span className={`absolute inset-y-0 left-0 w-1.5 ${COLOUR_STYLE[c.rag as Colour].stripe}`} aria-hidden />
              <Link href={`/cases/${c.id}`} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 pr-5 pl-6 text-pn-ink no-underline md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ColourPill rag={c.rag} label={t(`colour.${c.rag}`)} />
                    <span className="text-[14px] font-bold">{localizedText(c.category.nameEn, c.category.nameFr, locale)}</span>
                    <span className="text-[12px] text-pn-gray-3 tabular-nums">{formatCaseNumber(c.caseNumber)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.ragReasons.map((r) => (
                      <span key={r} className="bg-pn-panel px-1.5 text-[11px] text-pn-gray-1">
                        {t(`reason.${r}`)}
                      </span>
                    ))}
                    {replied && (
                      <span className="flex items-center gap-1 bg-[#e0ecff] px-1.5 text-[11px] font-semibold text-[#1d4ed8]">
                        <MessageSquareReply size={11} aria-hidden /> {t("memberReplied")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-0 text-[13px]">
                  <div className="truncate font-semibold">
                    {c.patient.firstName} {c.patient.lastName}
                    {age !== null && <span className="font-normal text-pn-gray-2"> · {t("ageYears", { age })}</span>}
                  </div>
                  {c.requestedBy.id !== c.patient.id && (
                    <div className="truncate text-[12px] text-pn-gray-2">{t("requestedBy", { name: `${c.requestedBy.firstName} ${c.requestedBy.lastName}` })}</div>
                  )}
                </div>
                <div className="text-[13px]">
                  <div className="text-pn-gray-1">{t(`status.${c.status}`)}</div>
                  <div className="text-[12px] text-pn-gray-2">{c.assignedTo ? (c.assignedTo.name ?? c.assignedTo.email) : t("unassigned")}</div>
                </div>
                <div className="text-[13px] tabular-nums md:text-right">
                  {due && ["NEW", "IN_PROGRESS"].includes(c.status) ? (
                    <span className={overdue ? "font-bold text-[#c62828]" : "text-pn-gray-1"}>
                      {overdue ? t("overdueBy", { time: shortDuration(now.getTime() - due.getTime()) }) : t("dueIn", { time: shortDuration(due.getTime() - now.getTime()) })}
                    </span>
                  ) : (
                    <span className="text-pn-gray-3">—</span>
                  )}
                  <div className="text-[12px] text-pn-gray-2">{t("waitingSince", { time: shortDuration(now.getTime() - c.createdAt.getTime()) })}</div>
                </div>
              </Link>
            </li>
          );
        })}
        {cases.length === 0 && <li className="p-8 text-center text-pn-gray-3">{t("empty")}</li>}
      </ul>
    </div>
  );
}
