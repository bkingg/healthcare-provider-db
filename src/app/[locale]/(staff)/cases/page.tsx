import { getLocale, getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { isOfficeHours } from "@/lib/businessHours";
import { formatCaseNumber } from "@/lib/caseNumber";
import { shortDuration } from "@/lib/caseTime";
import { ageFromDateOfBirth, formatMemberNumber } from "@/lib/memberNumber";
import { localizedText } from "@/lib/localizedText";
import { caseQueue, queueCounts, refreshOverdueCases, type QueueFilters } from "@/data/caseOps";
import { COLOUR_STYLE, type Colour } from "./_components/colour";
import { CasesTabs } from "./_components/cases-tabs";
import { CasesTable, type CaseRow } from "./_components/cases-table";
import { parseCaseSort, sortByValue, type CaseSortKey, type SortValue } from "@/lib/caseListSort";
import { Plus } from "lucide-react";
import { staffLabel } from "@/lib/handle";
import { formatDakarDateTime } from "@/lib/formatDate";
import { actionTiming } from "@/lib/caseActions";
import { listMyOpenActions, overdueActionsByPerson } from "@/data/caseActions";

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
    mentioned: one("mentioned") === "1",
    channel: ["MEMBER_APP", "PHONE", "EMAIL", "WHATSAPP", "WALK_IN"].includes(one("channel") ?? "") ? (one("channel") as QueueFilters["channel"]) : undefined,
    coverage: one("coverage") === "COVERED" || one("coverage") === "SPECIAL" ? (one("coverage") as "COVERED" | "SPECIAL") : undefined,
  };
}

export default async function CasesPage(props: PageProps<"/[locale]/cases">) {
  const t = await getTranslations("Cases");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireWorkCases(actor);

  // Overdue cases move up a colour whenever staff look — no background job.
  await refreshOverdueCases();
  const searchParams = await props.searchParams;
  const filters = parseFilters(searchParams);
  const sort = parseCaseSort(searchParams.sort, searchParams.dir);
  const now = new Date();
  const [queue, counts, myActions, overdueByPerson] = await Promise.all([caseQueue(filters, actor.id), queueCounts(now), listMyOpenActions(actor.id), overdueActionsByPerson(now)]);
  const inOffice = isOfficeHours(now);

  const typeOf = (c: (typeof queue)[number]) => localizedText(c.category.nameEn, c.category.nameFr, locale) ?? c.category.nameEn;
  const timed = (c: (typeof queue)[number]) => c.responseDueAt !== null && ["NEW", "IN_PROGRESS"].includes(c.status);
  const RAG_RANK = { RED: 0, YELLOW: 1, GREEN: 2 } as Record<string, number>;
  const STATUS_RANK = { NEW: 0, IN_PROGRESS: 1, WAITING_MEMBER: 2, RESOLVED: 3, CLOSED: 4 } as Record<string, number>;
  const URGENCY_RANK = { EMERGENCY: 0, TODAY: 1, THIS_WEEK: 2, ROUTINE: 3 } as Record<string, number>;
  const sortValue: Record<CaseSortKey, (c: (typeof queue)[number]) => SortValue | SortValue[]> = {
    priority: (c) => [RAG_RANK[c.rag], c.responseDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER, c.contactedAt.getTime()],
    caseNumber: (c) => c.caseNumber,
    type: typeOf,
    patient: (c) => [c.patient.lastName, c.patient.firstName],
    requestedBy: (c) => (c.requestedBy.id !== c.patient.id ? `${c.requestedBy.lastName} ${c.requestedBy.firstName}` : null),
    memberId: (c) => c.patient.memberNumber,
    status: (c) => STATUS_RANK[c.status],
    assigned: (c) => (c.assignedTo ? staffLabel(c.assignedTo) : null),
    nextAction: (c) => c.actions[0]?.dueAt.getTime(),
    due: (c) => (timed(c) ? c.responseDueAt!.getTime() : null),
    waiting: (c) => c.contactedAt.getTime(),
    created: (c) => c.createdAt.getTime(),
    channel: (c) => t(`channel.${c.channel}`),
    coverage: (c) => t(`coverage.${c.coverage}`),
    urgency: (c) => URGENCY_RANK[c.urgency],
    location: (c) => c.locationLabel,
    phone: (c) => c.contactPhone,
  };
  const cases = sortByValue(queue, sortValue[sort.key], sort.dir, locale);
  const tm = await getTranslations("MemberApp");
  const rows: CaseRow[] = cases.map((c) => {
    const due = c.responseDueAt;
    const overdue = due !== null && due < now && ["NEW", "IN_PROGRESS"].includes(c.status);
    const age = ageFromDateOfBirth(c.patient.dateOfBirth);
    const next = c.actions[0];
    return {
      id: c.id,
      rag: c.rag as Colour,
      ragLabel: t(`colour.${c.rag}`),
      caseNumber: formatCaseNumber(c.caseNumber),
      type: typeOf(c),
      reasons: c.ragReasons.map((r) => t(`reason.${r}`)),
      replied: c.events[0]?.type === "MESSAGE_FROM_MEMBER",
      channel: c.channel,
      channelLabel: t(`channel.${c.channel}`),
      coverage: c.coverage,
      coverageLabel: t(`coverage.${c.coverage}`),
      patient: `${c.patient.firstName} ${c.patient.lastName}`,
      patientAge: age !== null ? t("ageYears", { age }) : null,
      requestedBy: c.requestedBy.id !== c.patient.id ? `${c.requestedBy.firstName} ${c.requestedBy.lastName}` : null,
      memberId: c.patient.memberNumber !== null ? formatMemberNumber(c.patient.memberNumber) : null,
      statusLabel: t(`status.${c.status}`),
      assigned: c.assignedTo ? staffLabel(c.assignedTo) : null,
      nextAction: next
        ? {
            text: t("nextActionLine", { title: next.title, when: formatDakarDateTime(next.dueAt, locale), who: `@${next.owner.handle}` }),
            title: next.title,
            overdue: actionTiming(next.dueAt, now) === "OVERDUE",
          }
        : null,
      needsNextAction: ["NEW", "IN_PROGRESS", "WAITING_MEMBER"].includes(c.status),
      due: due && timed(c) ? { text: overdue ? t("overdueBy", { time: shortDuration(now.getTime() - due.getTime()) }) : t("dueIn", { time: shortDuration(due.getTime() - now.getTime()) }), overdue } : null,
      waiting: shortDuration(now.getTime() - c.contactedAt.getTime()),
      created: formatDakarDateTime(c.createdAt, locale),
      urgencyLabel: tm(`urgency.${c.urgency}`),
      location: c.locationLabel,
      phone: c.contactPhone,
    };
  });

  // Links that change the colour keep the current search.
  const queueHref = (extra: { colour?: Colour }) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (extra.colour) params.set("colour", extra.colour);
    if (sort.key !== "priority" || sort.dir !== "asc") {
      params.set("sort", sort.key);
      params.set("dir", sort.dir);
    }
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
          <div className="mt-2">
            <CasesTabs current="queue" myActions={myActions.length} />
          </div>
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
        <Link href="/cases/new" className="flex h-8 items-center gap-1.5 bg-pn-accent px-3 text-xs font-semibold text-white no-underline hover:bg-pn-accent-hover">
          <Plus size={14} aria-hidden /> {t("newCase.button")}
        </Link>
      </div>

      <div className="flex flex-none flex-wrap gap-2 px-5 pt-4">
        {tile("RED", counts.RED)}
        {tile("YELLOW", counts.YELLOW)}
        {tile("GREEN", counts.GREEN)}
        {tile("OVERDUE", counts.overdue)}
      </div>

      {overdueByPerson.length > 0 && (
        <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-3 text-[12.5px]">
          <span className="font-bold text-[#c62828]">{t("overdueActionsBy")}</span>
          {overdueByPerson.map((r) => (
            <span key={r.user.id} className="text-pn-gray-1">
              <Link href={`/cases?q=${encodeURIComponent(`@${r.user.handle}`)}`} className="font-semibold text-pn-ink">
                @{r.user.handle}
              </Link>{" "}
              <span className="font-bold text-[#c62828] tabular-nums">{r.count}</span>
            </span>
          ))}
        </div>
      )}

      <form method="get" className="flex flex-none flex-wrap items-end gap-2 px-5 py-3">
        {filters.colour && <input type="hidden" name="colour" value={filters.colour} />}
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {(sort.key !== "priority" || sort.dir !== "asc") && (
          <>
            <input type="hidden" name="sort" value={sort.key} />
            <input type="hidden" name="dir" value={sort.dir} />
          </>
        )}
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
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("newCase.channel")}
          <select name="channel" defaultValue={filters.channel ?? ""} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            <option value="">{t("anyChannel")}</option>
            {["MEMBER_APP", "PHONE", "EMAIL", "WHATSAPP", "WALK_IN"].map((ch) => (
              <option key={ch} value={ch}>
                {t(`channel.${ch}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("newCase.coverage")}
          <select name="coverage" defaultValue={filters.coverage ?? ""} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            <option value="">{t("anyCoverage")}</option>
            <option value="COVERED">{t("coverage.COVERED")}</option>
            <option value="SPECIAL">{t("specialRequests")}</option>
          </select>
        </label>
        <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[13px]">
          <input type="checkbox" name="mentioned" value="1" defaultChecked={filters.mentioned} className="h-4 w-4 accent-pn-ink" />
          {t("mentionedMe")}
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

      <CasesTable rows={rows} sort={sort} />
    </div>
  );
}
