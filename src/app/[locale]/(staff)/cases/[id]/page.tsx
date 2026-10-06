import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Check, ChevronRight, ExternalLink, Eye, EyeOff, Lock, MapPinned, MessageCircle, Phone, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { canManageMembers, requireWorkCases } from "@/lib/rbac";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatMemberNumber, ageFromDateOfBirth } from "@/lib/memberNumber";
import { formatProviderNumber } from "@/lib/providerNumber";
import { formatDakarDateTime } from "@/lib/formatDate";
import { shortDuration } from "@/lib/caseTime";
import { localizedText } from "@/lib/localizedText";
import { LinkifiedText } from "@/components/linkified-text";
import { getCaseForStaff, listActiveNoteTemplates, listCaseWorkers, refreshOverdueCases } from "@/data/caseOps";
import { NotesList } from "../_components/notes-list";
import { ColourPill } from "../_components/colour";
import { WriteBox } from "../_components/write-box";
import { ColourOverride } from "../_components/colour-override";
import { FindProviders } from "../_components/find-providers";
import { AssigneePicker } from "../_components/assignee-picker";
import { ActionsPanel, type ActionItem } from "../_components/actions-panel";
import { StatusForm } from "../_components/status-form";
import { CoverageForm } from "../_components/coverage-form";
import { ChannelIcon, CoverageTag } from "../_components/channel-icon";
import { TagById } from "../_components/tag-by-id";
import { assignCaseAction, setCaseVisibilityAction, toggleProviderAction, untagProviderAction } from "../actions";
import { DoNotUseFlag } from "@/components/do-not-use-flag";
import { PnTag } from "@/components/pn-tag";
import { staffLabel } from "@/lib/handle";
import { actionTiming } from "@/lib/caseActions";
import { markCaseNotificationsRead } from "@/data/caseActions";
import { orderForCase } from "@/data/medicationOrders";
import { MedicationOrderSummary } from "@/components/medication-order-summary";
import { pharmacyCandidates, prepareQuotes, quotesForOrder, refreshQuotes, responseStats } from "@/data/pharmacyQuotes";
import { rankPharmacies } from "@/lib/pharmacyRanking";
import { isOpenAt } from "@/lib/openNow";
import { formatProviderNumber as providerCode } from "@/lib/providerNumber";
import { PharmacyPanel } from "../_components/pharmacy-panel";
import type { NoteMentions } from "@/components/formatted-note";

type TimelineEvent = NonNullable<Awaited<ReturnType<typeof getCaseForStaff>>>["events"][number];

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-pn-ink pb-1">
        <h2 className="m-0 text-[12px] font-bold tracking-[0.08em] uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-pn-rule py-1.5 text-[13px] last:border-b-0">
      <dt className="text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children ?? <span className="text-pn-gray-3">—</span>}</dd>
    </div>
  );
}

export default async function CasePage(props: PageProps<"/[locale]/cases/[id]">) {
  const t = await getTranslations("Cases");
  const tm = await getTranslations("MemberApp");
  const tOrder = await getTranslations("MemberOrder");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireWorkCases(actor);
  await refreshOverdueCases();

  const { id } = await props.params;
  // A bell link points at one note or action: open and highlight it.
  const search = await props.searchParams;
  const focusNoteId = typeof search.note === "string" ? search.note : null;
  const focusActionId = typeof search.action === "string" ? search.action : null;
  const [c, workers, noteTemplates, medicationOrder] = await Promise.all([getCaseForStaff(id), listCaseWorkers(), listActiveNoteTemplates(), orderForCase(id)]);
  // Templates in the staff screen's language (French falls back to English).
  const templateOptions = noteTemplates.map((x) => ({
    id: x.id,
    name: localizedText(x.nameEn, x.nameFr, locale) ?? x.nameEn,
    body: (locale === "fr" ? (x.bodyFr ?? x.bodyEn) : (x.bodyEn ?? x.bodyFr)) ?? "",
  }));
  if (!c) notFound();
  // Opening the case counts as having seen what you were told about it.
  await markCaseNotificationsRead(c.id, actor.id);

  // Medication order: expire stale quote links and, once everyone asked has
  // replied (or the wait is over), choose the best quote — then load the
  // pharmacies panel.
  let pharmacies: React.ComponentProps<typeof PharmacyPanel> | null = null;
  if (medicationOrder) {
    // An order still waiting with no pharmacies picked (e.g. placed before
    // this existed, or the first pick failed): pick them now.
    if (medicationOrder.status === "REQUESTED") await prepareQuotes(medicationOrder.id);
    await refreshQuotes(medicationOrder.id);
    const [{ order: qo, urgent, comparison }, candidates, stats] = await Promise.all([quotesForOrder(medicationOrder.id), pharmacyCandidates(), responseStats()]);
    const asked = new Set(qo.quotes.map((q) => q.providerId));
    const point = qo.deliveryLatitude !== null && qo.deliveryLongitude !== null ? { lat: qo.deliveryLatitude, lng: qo.deliveryLongitude } : null;
    const nowDate = new Date();
    const nameOf = (id: string) => qo.quotes.find((q) => q.id === id)?.provider.names[0]?.fullNameText ?? "";
    pharmacies = {
      orderId: qo.id,
      chosenQuoteId: qo.chosenQuoteId,
      bestId: comparison.bestId,
      urgent,
      totalItems: qo.lines.length,
      needsNarcotic: qo.hasNarcotic,
      needsCold: qo.hasColdChain,
      items: qo.lines.map((l) => ({
        id: l.id,
        label: l.freeText ?? [l.dci, l.strength, l.form].filter(Boolean).join(" "),
        brand: l.brandName,
        quantity: l.quantity,
        narcotic: l.regulatoryClass === "NARCOTIC",
        cold: l.isColdChain,
      })),
      quotes: qo.quotes.map((q) => {
        const row = comparison.rows.find((r) => r.id === q.id);
        return {
          id: q.id,
          providerName: q.provider.names[0]?.fullNameText ?? "",
          providerCode: providerCode(q.provider.providerNumber),
          status: q.status,
          openNow: isOpenAt(q.provider, nowDate),
          distanceKm: q.distanceKm,
          sentAt: q.sentAt ? formatDakarDateTime(q.sentAt, locale) : null,
          answeredAt: q.answeredAt ? formatDakarDateTime(q.answeredAt, locale) : null,
          expiresAt: q.expiresAt ? formatDakarDateTime(q.expiresAt, locale) : null,
          hasPhone: Boolean(q.provider.phones[0]?.number),
          enteredByStaff: q.enteredByStaff,
          initial:
            q.status === "ANSWERED" || q.status === "DECLINED"
              ? {
                  preparationMinutes: q.preparationMinutes,
                  canDispenseNarcotic: q.canDispenseNarcotic,
                  canPackColdChain: q.canPackColdChain,
                  pharmacistName: q.pharmacistName,
                  note: q.note,
                  lines: q.lines.map((l) => ({ orderLineId: l.orderLineId, availability: l.availability, quantityOffered: l.quantityOffered, packPriceXof: l.packPriceXof, packDescription: l.packDescription, unitsPerPack: l.unitsPerPack, substitution: l.substitution })),
                }
              : null,
          row: row
            ? { eligible: row.eligible, reason: row.reason, complete: row.complete, covered: row.coveredLineIds.length, medicinesXof: row.medicinesXof, deliveryXof: row.deliveryXof, totalXof: row.totalXof, doorMinutes: row.doorMinutes, hasSubstitution: row.hasSubstitution }
            : null,
        };
      }),
      candidates: rankPharmacies(candidates, point, nowDate, stats)
        .filter((p) => !asked.has(p.id))
        .slice(0, 25)
        .map((p) => ({ id: p.id, name: p.name, code: providerCode(p.providerNumber), openNow: p.openNow, distanceKm: p.distanceKm })),
      partial: comparison.partial ? { provider: nameOf(comparison.partial.quoteId), missing: comparison.partial.missing.map((m) => ({ label: m.label, elsewhere: m.elsewhere })) } : null,
      fasterButDearer: comparison.fasterButDearer ? { provider: nameOf(comparison.fasterButDearer.quoteId), percentMore: comparison.fasterButDearer.percentMore } : null,
    };
  }
  // Reloaded after the check above, which may have chosen a quote.
  const orderShown = medicationOrder ? await orderForCase(id) : null;

  const now = new Date();
  const due = c.responseDueAt;
  const timerRunning = due !== null && (c.status === "NEW" || c.status === "IN_PROGRESS");
  const overdue = timerRunning && due! < now;
  const patientAge = ageFromDateOfBirth(c.patient.dateOfBirth);
  const phoneDigits = c.contactPhone.replace(/[^\d]/g, "");
  const conversation = c.events.filter((e) => e.type === "MESSAGE_TO_MEMBER" || e.type === "MESSAGE_FROM_MEMBER");
  const notes = c.events.filter((e) => e.type === "NOTE");
  const activity = c.events.filter((e) => !conversation.includes(e) && !notes.includes(e));
  const awaitingReply = conversation.at(-1)?.type === "MESSAGE_FROM_MEMBER" && c.status !== "CLOSED";
  const showMemberLinks = canManageMembers(actor);
  const who = (e: TimelineEvent) =>
    e.actorType === "SYSTEM" ? t("actor.SYSTEM") : e.actorType === "MEMBER" ? `${e.member?.firstName ?? ""} ${e.member?.lastName ?? ""}`.trim() || t("actor.MEMBER") : (e.staff ? staffLabel(e.staff) : t("actor.STAFF"));

  // After who(): it's called while building the list.
  const noteItems = notes.map((e) => {
    const d = (e.data ?? {}) as { noteType?: string; nameEn?: string; nameFr?: string | null };
    const mentions: NoteMentions = Object.fromEntries(
      e.mentions.map((m) => [m.handle, { handle: m.user.handle, label: staffLabel(m.user), isMe: m.user.id === actor.id }]),
    );
    return {
      id: e.id,
      typeName: d.noteType ? (localizedText(d.nameEn ?? d.noteType, d.nameFr ?? null, locale) ?? null) : null,
      author: who(e),
      when: formatDakarDateTime(e.createdAt, locale),
      body: e.body ?? "",
      mentions,
      mentionsMe: e.mentions.some((m) => m.user.id === actor.id),
    };
  });

  const actionItems: ActionItem[] = c.actions.map((a) => ({
    id: a.id,
    title: a.title,
    owner: staffLabel(a.owner),
    mine: a.ownerId === actor.id,
    due: formatDakarDateTime(a.dueAt, locale),
    timing: actionTiming(a.dueAt, now),
    done: a.completedAt !== null,
    doneNote: a.completedAt
      ? a.closedWithCase
        ? t("actionClosedWithCase")
        : t("actionDoneBy", { who: a.completedBy ? staffLabel(a.completedBy) : "?", when: formatDakarDateTime(a.completedAt, locale) })
      : null,
  }));
  const openActionCount = actionItems.filter((a) => !a.done).length;
  const actionOwner = (ownerId: unknown) => {
    const o = c.actions.find((a) => a.ownerId === ownerId)?.owner ?? workers.find((w) => w.id === ownerId);
    return o ? staffLabel(o) : "?";
  };

  function describe(e: TimelineEvent): string {
    const d = (e.data ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "CREATED":
        return e.actorType === "STAFF" ? t("event.CREATED_STAFF", { channel: t(`channel.${d.channel ?? "PHONE"}`).toLowerCase() }) : t("event.CREATED");
      case "QUOTE_SENT":
      case "QUOTE_ANSWERED":
      case "QUOTE_CHOSEN":
        return t(`event.${e.type}${e.type === "QUOTE_ANSWERED" && d.declined ? "_DECLINED" : e.type === "QUOTE_CHOSEN" && d.auto ? "_AUTO" : ""}`, { provider: String(d.provider ?? "?") });
      case "ORDER_STATUS_CHANGED":
        return t("event.ORDER_STATUS_CHANGED", { to: tOrder(`status.${String(d.to)}`) });
      case "PROVIDER_TAGGED":
      case "PROVIDER_UNTAGGED":
        return t(`event.${e.type}`, { code: String(d.code ?? "?") });
      case "COVERAGE_CHANGED":
        return t("event.COVERAGE_CHANGED", { to: t(`coverage.${d.to}`) });
      case "VISIBILITY_CHANGED":
        return d.visible ? t("event.SHOWN_TO_MEMBER") : t("event.HIDDEN_FROM_MEMBER");
      case "COLOUR_SET":
        return t("event.COLOUR_SET", { to: t(`colour.${d.to}`) });
      case "ESCALATED":
        return t("event.ESCALATED", { from: t(`colour.${d.from}`), to: t(`colour.${d.to}`) });
      case "COLOUR_OVERRIDDEN":
        return t("event.COLOUR_OVERRIDDEN", { from: t(`colour.${d.from}`), to: t(`colour.${d.to}`) });
      case "STATUS_CHANGED":
        return t("event.STATUS_CHANGED", { to: t(`status.${d.to}`) });
      case "ASSIGNED": {
        const to = workers.find((w) => w.id === d.to);
        return d.to ? t("event.ASSIGNED", { to: to ? staffLabel(to) : "?" }) : t("event.UNASSIGNED");
      }
      case "PROVIDERS_FOUND":
        return t("event.PROVIDERS_FOUND", { count: Number(d.count ?? 0), km: Number(d.radiusKm ?? 0) });
      case "PROVIDER_SELECTED":
        return d.selected ? t("event.PROVIDER_SELECTED") : t("event.PROVIDER_UNSELECTED");
      case "ACTION_ADDED":
        return t("event.ACTION_ADDED", { title: String(d.title ?? ""), who: actionOwner(d.ownerId), when: d.dueAt ? formatDakarDateTime(new Date(String(d.dueAt)), locale) : "?" });
      case "ACTION_DONE":
      case "ACTION_REOPENED":
        return t(`event.${e.type}`, { title: String(d.title ?? "") });
      case "ACTIONS_CLOSED_WITH_CASE":
        return t("event.ACTIONS_CLOSED_WITH_CASE", { count: Number(d.count ?? 0) });
      default:
        return t(`event.${e.type}`);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-col gap-2 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <Link href="/cases" className="flex w-fit items-center gap-1 text-[11px] tracking-[0.04em] text-pn-gray-3 hover:text-pn-ink">
          <ArrowLeft size={12} aria-hidden /> {t("title")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{localizedText(c.category.nameEn, c.category.nameFr, locale)}</h1>
          <span className="text-[13px] text-pn-gray-3 tabular-nums">{formatCaseNumber(c.caseNumber)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <ColourPill rag={c.rag} label={t(`colour.${c.rag}`)} />
          {c.ragReasons.map((r) => (
            <span key={r} className="bg-pn-panel px-1.5 text-[11.5px] text-pn-gray-1">
              {t(`reason.${r}`)}
            </span>
          ))}
          <span className="text-pn-gray-2">· {t(`status.${c.status}`)}</span>
          {timerRunning && (
            <span className={overdue ? "font-bold text-[#c62828]" : "text-pn-gray-2"}>
              · {overdue ? t("overdueBy", { time: shortDuration(now.getTime() - due!.getTime()) }) : t("dueIn", { time: shortDuration(due!.getTime() - now.getTime()) })}
            </span>
          )}
          <span className="flex items-center gap-1 text-pn-gray-3">
            · <ChannelIcon channel={c.channel} label={t(`channel.${c.channel}`)} size={12} /> {t("contactedAtLine", { channel: t(`channel.${c.channel}`), when: formatDakarDateTime(c.contactedAt, locale) })}
          </span>
          <CoverageTag coverage={c.coverage} label={t(`coverage.${c.coverage}`)} />
          {!c.visibleToMember && (
            <span className="flex items-center gap-1 bg-pn-panel px-1.5 text-[11.5px] font-semibold text-pn-gray-1">
              <EyeOff size={11} aria-hidden /> {t("hiddenFromApp")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-1">
          {/* Both forms are keyed on updatedAt so they remount with the saved
           * values after any change — otherwise their selects keep showing
           * what was true when the page first loaded (e.g. "New" after a
           * message moved the case to in progress), and pressing Update
           * would silently undo the change. */}
          <form key={`assign-${c.updatedAt.getTime()}`} action={assignCaseAction} className="flex items-end gap-1">
            <input type="hidden" name="caseId" value={c.id} />
            <div className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
              <span aria-hidden>{t("assignedTo")}</span>
              <AssigneePicker workers={workers} defaultId={c.assignedToId} meId={actor.id} />
            </div>
            <button type="submit" className="h-8 cursor-pointer border-2 border-pn-ink bg-white px-3 text-xs font-semibold hover:bg-pn-surface-hover">
              {t("assign")}
            </button>
          </form>
<StatusForm key={`status-${c.updatedAt.getTime()}`} caseId={c.id} current={c.status} openActions={openActionCount} />
          <ColourOverride caseId={c.id} current={c.rag} />
          <CoverageForm key={`coverage-${c.updatedAt.getTime()}`} caseId={c.id} current={c.coverage} patientCovered={c.patient.isCovered} />
        </div>
      </div>

      {/* Wide screens: case details | conversation with the member | internal
       * notes and activity. Laptops: details on the left, conversation above
       * notes on the right (so the work area is never pushed below the
       * fold). Phones: everything stacked. The panels' wrapper becomes
       * `display: contents` on wide screens so each panel takes a column. */}
      <div className="grid grid-cols-1 gap-6 px-5 py-5 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <div className="flex flex-col gap-6">
          <Section title={t("theRequest")}>
            <blockquote className="m-0 border-l-4 border-pn-ink bg-white px-3 py-2 text-[14px] whitespace-pre-line">
              <LinkifiedText text={c.description} />
            </blockquote>
            <dl className="m-0">
              <Row label={t("urgency")}>{tm(`urgency.${c.urgency}`)}</Row>
              <Row label={t("callback")}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums">{c.contactPhone}</span>
                  <a href={`tel:${c.contactPhone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1 border border-pn-ink px-1.5 text-[12px] font-semibold text-pn-ink no-underline">
                    <Phone size={11} aria-hidden /> {t("call")}
                  </a>
                  {c.contactHasWhatsapp && (
                    <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 border border-[#128c4a] px-1.5 text-[12px] font-semibold text-[#0b5a30] no-underline">
                      <MessageCircle size={11} aria-hidden /> WhatsApp
                    </a>
                  )}
                </span>
              </Row>
              <Row label={t("location")}>
                {c.locationLabel || c.latitude !== null ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {c.locationLabel ?? t("sharedPosition")}
                    {c.latitude !== null && c.longitude !== null && (
                      <Link
                        href={`/map?lat=${c.latitude}&lng=${c.longitude}&radiusKm=10&pointLabel=${encodeURIComponent(formatCaseNumber(c.caseNumber))}`}
                        className="flex items-center gap-1 text-[12px] font-semibold text-[#0a5c3c]"
                      >
                        <MapPinned size={12} aria-hidden /> {t("openMap")}
                      </Link>
                    )}
                  </span>
                ) : null}
              </Row>
            </dl>
          </Section>

          {medicationOrder && (
            <Section title={t("medicationOrder")}>
              {orderShown && <MedicationOrderSummary order={orderShown} viewer="staff" />}
              {pharmacies && (
                <div className="mt-2 border-t border-pn-rule pt-3">
                  <PharmacyPanel {...pharmacies} />
                </div>
              )}
            </Section>
          )}

          <Section title={t("forWhom")}>
            <dl className="m-0">
              <Row label={t("patient")}>
                <span className="font-semibold">
                  {c.patient.firstName} {c.patient.lastName}
                </span>
                {patientAge !== null && ` · ${t("ageYears", { age: patientAge })}`}
                {c.patient.primaryMemberId && c.patient.relationship && ` · ${localizedText(c.patient.relationship.nameEn, c.patient.relationship.nameFr, locale)}`}
                {" · "}
                <span className="tabular-nums">{formatMemberNumber(c.patient.memberNumber)}</span>
                {showMemberLinks && (
                  <Link href={`/members/${c.patient.id}`} className="ml-2 text-[12px] font-semibold text-[#0a5c3c]">
                    {t("memberRecord")}
                  </Link>
                )}
              </Row>
              {c.requestedById !== c.patientId && (
                <Row label={t("requestedByLabel")}>
                  {c.requestedBy.firstName} {c.requestedBy.lastName}
                </Row>
              )}
              <Row label={t("cover")}>
                {!c.patient.isCovered
                  ? t("notCoveredPerson")
                  : c.patient.organization
                    ? [c.patient.organization.name, c.patient.planName, c.patient.policyNumber].filter(Boolean).join(" · ")
                    : t("individual")}
              </Row>
              <Row label={t("language")}>{c.patient.preferredLanguage === "en" ? "English" : "Français"}</Row>
            </dl>
          </Section>

          <Section
            title={t("tagging.title")}
            action={
              <Link href={`/providers?tagCase=${c.id}`} className="flex h-8 items-center gap-1.5 border-2 border-pn-ink bg-white px-3 text-xs font-semibold text-pn-ink no-underline hover:bg-pn-surface-hover">
                <Search size={13} aria-hidden /> {t("tagging.searchProviders")}
              </Link>
            }
          >
            {c.providerTags.length === 0 ? (
              <p className="m-0 text-[12.5px] text-pn-gray-2">{t("tagging.empty")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {c.providerTags.map((tag) => {
                  const p = tag.provider;
                  const type = p.providerTypes[0]?.providerType;
                  return (
                    <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 border-2 px-3 py-2 ${p.status === "DO_NOT_USE" ? "border-[#c62828] bg-[#fdecec]" : "border-pn-ink bg-white"}`}>
                      <div className="min-w-0">
                        <Link href={`/providers/${p.id}`} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-pn-ink hover:underline">
                          <DoNotUseFlag status={p.status} />
                          {p.names[0]?.fullNameText ?? formatProviderNumber(p.providerNumber)}
                          <span className="font-normal text-pn-gray-3 tabular-nums">{formatProviderNumber(p.providerNumber)}</span>
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-pn-gray-2">
                          {type && <span>{localizedText(type.nameEn, type.nameFr, locale)}</span>}
                          {p.addresses[0]?.city && <span>· {p.addresses[0].city}</span>}
                          {p.phones[0] && (
                            <a href={`tel:${p.phones[0].number.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1 font-semibold text-pn-ink tabular-nums no-underline">
                              · <Phone size={11} aria-hidden /> {p.phones[0].number}
                            </a>
                          )}
                          {p.status !== "ACTIVE" && <PnTag status={p.status} />}
                          <span className="text-pn-gray-3">· {t("tagging.taggedBy", { who: staffLabel(tag.taggedBy), when: formatDakarDateTime(tag.createdAt, locale) })}</span>
                        </div>
                      </div>
                      <form action={untagProviderAction}>
                        <input type="hidden" name="caseId" value={c.id} />
                        <input type="hidden" name="providerId" value={p.id} />
                        <button type="submit" className="cursor-pointer text-[12px] font-semibold text-pn-gray-2 hover:text-[#b91c1c] hover:underline">
                          {t("tagging.remove")}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <TagById caseId={c.id} taggedIds={c.providerTags.map((tag) => tag.providerId)} />
          </Section>

          <Section title={t("providers")} action={<FindProviders caseId={c.id} hasResults={c.providerOptions.length > 0} />}>
            {c.providerOptions.length === 0 ? (
              <p className="m-0 text-[12.5px] text-pn-gray-2">{t("providersHint")}</p>
            ) : (
              // Grid rows: details | distance | button. The button column has a
              // fixed width, so "Mark chosen" and "Chosen" line up row to row.
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {c.providerOptions.map((o) => {
                  const p = o.provider;
                  const type = p.providerTypes[0]?.providerType;
                  const meta = [type ? localizedText(type.nameEn, type.nameFr, locale) : null, p.addresses[0]?.city].filter(Boolean).join(" · ");
                  return (
                    <li
                      key={o.providerId}
                      className={`grid grid-cols-[minmax(0,1fr)_auto_120px] items-center gap-3 border border-l-4 px-3 py-2 max-[520px]:grid-cols-[minmax(0,1fr)_auto] ${
                        o.selected ? "border-pn-accent bg-pn-accent-soft" : "border-pn-rule border-l-pn-border-muted bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <Link href={`/providers/${p.id}`} className="flex min-w-0 items-baseline gap-1.5 text-[13.5px] font-semibold text-pn-ink hover:underline">
                          <span className="truncate" title={p.names[0]?.fullNameText ?? undefined}>
                            {p.names[0]?.fullNameText ?? formatProviderNumber(p.providerNumber)}
                          </span>
                          <span className="flex-none text-[12px] font-normal text-pn-gray-3 tabular-nums">{formatProviderNumber(p.providerNumber)}</span>
                          <ExternalLink size={11} aria-hidden className="flex-none self-center text-pn-gray-3" />
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-pn-gray-2">
                          {meta && <span>{meta}</span>}
                          {p.phones[0] && (
                            <a href={`tel:${p.phones[0].number.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1 font-semibold text-pn-gray-1 tabular-nums no-underline hover:text-pn-ink">
                              <Phone size={11} aria-hidden /> {p.phones[0].number}
                            </a>
                          )}
                          {p.isOpen24_7 && <span className="bg-pn-panel px-1 text-[11px] font-semibold text-pn-gray-1">{t("open247")}</span>}
                          {p.erOpen24_7 && <span className="bg-[#fbe5e5] px-1 text-[11px] font-semibold text-[#991b1b]">{t("er247")}</span>}
                        </div>
                      </div>
                      <div className="text-right text-[13px] font-semibold text-pn-ink tabular-nums">{o.distanceKm !== null ? t("km", { km: o.distanceKm }) : <span className="text-pn-gray-3">—</span>}</div>
                      <form action={toggleProviderAction} className="max-[520px]:col-span-2">
                        <input type="hidden" name="caseId" value={c.id} />
                        <input type="hidden" name="providerId" value={o.providerId} />
                        <button
                          type="submit"
                          aria-pressed={o.selected}
                          className={`flex h-8 w-full cursor-pointer items-center justify-center gap-1 border-2 text-[12px] font-semibold ${
                            o.selected ? "border-pn-accent bg-pn-accent text-white hover:bg-pn-accent-hover" : "border-pn-ink bg-white hover:bg-pn-surface-hover"
                          }`}
                        >
                          {o.selected && <Check size={13} aria-hidden />}
                          {o.selected ? t("chosen") : t("choose")}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6 2xl:contents">
          {/* The member conversation and internal notes are separate panels,
           * each with its own box and button — no mode switch, so a note can't
           * be sent to a member by mistake. */}
          <Section title={t("conversationWith", { name: c.requestedBy.firstName })} action={awaitingReply ? <span className="bg-[#e0ecff] px-1.5 text-[11px] font-semibold text-[#1d4ed8]">{t("replyNeeded", { name: c.requestedBy.firstName })}</span> : undefined}>
            <div className="flex flex-col gap-3 border-2 border-pn-ink bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 flex items-center gap-1.5 text-[11.5px] text-pn-gray-2">
                  {c.visibleToMember ? <Eye size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
                  {c.visibleToMember ? t("conversationVisible", { name: c.requestedBy.firstName }) : t("conversationHidden", { name: c.requestedBy.firstName })}
                </p>
                <form action={setCaseVisibilityAction}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="visible" value={c.visibleToMember ? "0" : "1"} />
                  <button type="submit" className={`cursor-pointer px-2 py-0.5 text-[11.5px] font-semibold ${c.visibleToMember ? "text-pn-gray-2 hover:text-pn-ink hover:underline" : "border-2 border-pn-ink bg-white hover:bg-pn-surface-hover"}`}>
                    {c.visibleToMember ? t("hideFromApp") : t("showInApp", { name: c.requestedBy.firstName })}
                  </button>
                </form>
              </div>
              {/* column-reverse keeps the newest message in view, next to the box. */}
              <div className="flex max-h-[520px] flex-col-reverse overflow-auto">
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {conversation.length === 0 && c.visibleToMember && <li className="py-6 text-center text-[12.5px] text-pn-gray-3">{t("conversationEmpty", { name: c.requestedBy.firstName })}</li>}
                  {conversation.map((e) => {
                    const fromMember = e.type === "MESSAGE_FROM_MEMBER";
                    return (
                      <li key={e.id} className={`flex max-w-[88%] flex-col gap-0.5 px-3 py-2 text-[13.5px] ${fromMember ? "self-start bg-[#eef4ff]" : "self-end border-r-4 border-pn-accent bg-pn-accent-soft"}`}>
                        <span className="text-[11px] text-pn-gray-2">
                          <span className="font-semibold text-pn-gray-1">{who(e)}</span> · {formatDakarDateTime(e.createdAt, locale)}
                        </span>
                        <p className="m-0 break-words whitespace-pre-line">
                          <LinkifiedText text={e.body ?? ""} />
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
              {c.visibleToMember ? (
                <WriteBox variant="message" caseId={c.id} memberName={c.requestedBy.firstName} memberLanguage={c.requestedBy.preferredLanguage} />
              ) : (
                <p className="m-0 border-l-4 border-pn-border-muted bg-pn-panel px-3 py-2 text-[12.5px] text-pn-gray-1">{t("hiddenNoMessages", { name: c.requestedBy.firstName })}</p>
              )}
            </div>
          </Section>

          <div className="flex flex-col gap-6">
            <Section
              title={t("actionsTitle")}
              action={openActionCount > 0 ? <span className="text-[11.5px] font-semibold text-pn-gray-2">{t("actionsOpenCount", { count: openActionCount })}</span> : undefined}
            >
              <ActionsPanel caseId={c.id} actions={actionItems} workers={workers} meId={actor.id} defaultOwnerId={c.assignedToId} focusId={focusActionId} />
            </Section>

            <Section title={t("notesTitle")}>
              <div className="flex flex-col gap-3 border-2 border-[#e8c98a] bg-[#fffaf0] p-3">
                <p className="m-0 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#92400e]">
                  <Lock size={12} aria-hidden /> {t("notesNeverShown")}
                </p>
                <NotesList notes={noteItems} focusId={focusNoteId} />
                <WriteBox
                  variant="note"
                  caseId={c.id}
                  memberName={c.requestedBy.firstName}
                  memberLanguage={c.requestedBy.preferredLanguage}
                  templates={templateOptions}
                  workers={workers}
                  meId={actor.id}
                  defaultOwnerId={c.assignedToId}
                />
              </div>
            </Section>

            {/* Status, colour, assignment and provider changes — the audit
             * trail, collapsed by default so it doesn't crowd the two panels. */}
            <details className="group border border-pn-rule bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12px] font-bold tracking-[0.08em] uppercase select-none hover:bg-pn-surface-hover">
                <ChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
                {t("activityTitle", { count: activity.length })}
              </summary>
              <ol className="m-0 flex list-none flex-col gap-1 border-t border-pn-rule p-2">
                {[...activity].reverse().map((e) => (
                  <li key={e.id} className="flex flex-col gap-0.5 px-1 py-1 text-[12px] text-pn-gray-1">
                    <span className="flex flex-wrap justify-between gap-2">
                      <span>
                        <span className="font-semibold">{who(e)}</span> · {describe(e)}
                      </span>
                      <span className="text-pn-gray-3 tabular-nums">{formatDakarDateTime(e.createdAt, locale)}</span>
                    </span>
                    {e.body && <span className="text-pn-gray-2 italic">“{e.body}”</span>}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
