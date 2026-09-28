"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListPlus, Search, UserPlus, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatMemberNumber } from "@/lib/memberNumber";
import { localizedText } from "@/lib/localizedText";
import { initialRag, type Rag } from "@/lib/caseRules";
import { toDueInput } from "@/lib/caseActions";
import type { ActionResult } from "@/lib/validation/common";
import { createStaffCaseAction, findMembersForCaseAction, type MemberMatch } from "../actions";
import { AssigneePicker, type Worker } from "./assignee-picker";
import { ActionFields } from "./action-fields";
import { ChannelIcon } from "./channel-icon";
import { COLOUR_STYLE } from "./colour";

type Category = { id: string; code: string; label: string };
type Country = { id: string; label: string; iso2: string | null };

const CHANNELS = ["PHONE", "EMAIL", "WHATSAPP", "WALK_IN"] as const;
const URGENCIES = ["EMERGENCY", "TODAY", "THIS_WEEK", "ROUTINE"] as const;
const COVERAGES = ["COVERED", "SPECIAL_FREE", "SPECIAL_PAID"] as const;
const COLOURS: Rag[] = ["RED", "YELLOW", "GREEN"];

const inputClass = "h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] text-pn-ink outline-none focus:border-pn-ink";
const labelClass = "flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase";

function Choice<T extends string>({ value, options, onChange, label, disabled = [] }: { value: T; options: readonly { id: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string; disabled?: T[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled.includes(o.id)}
          onClick={() => onChange(o.id)}
          className={`flex cursor-pointer items-center gap-1.5 border-2 px-2.5 py-1 text-[12.5px] font-semibold normal-case tracking-normal disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.id ? "border-pn-ink bg-pn-ink text-white" : "border-pn-border-muted bg-white text-pn-ink hover:border-pn-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-pn-rule pb-5">
      <h2 className="m-0 flex items-center gap-2 text-[12px] font-bold tracking-[0.08em] uppercase">
        <span className="flex h-5 w-5 items-center justify-center bg-pn-ink text-[11px] text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The staff "New case" form: who got in touch (found, or added as a new
 * person), how and when, what they need, cover, colour, who handles it,
 * whether the member sees it in the app, and optionally a first note and
 * next action. Every field is controlled, so a failed save keeps what was
 * typed. */
export function NewCaseForm({ categories, workers, meId, countries }: { categories: Category[]; workers: Worker[]; meId: string; countries: Country[] }) {
  const t = useTranslations("Cases");
  const tn = useTranslations("Cases.newCase");
  const tm = useTranslations("MemberApp");
  const locale = useLocale();
  const router = useRouter();

  // ---- who
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MemberMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [requester, setRequester] = useState<MemberMatch | null>(null);
  const [patientId, setPatientId] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [np, setNp] = useState({ firstName: "", lastName: "", dateOfBirth: "", phone: "", email: "", preferredLanguage: locale === "en" ? "en" : "fr", countryId: countries.find((c) => c.iso2 === "SN")?.id ?? "", isCovered: false });

  const searchSeq = useRef(0);
  useEffect(() => {
    if (addingPerson || requester || query.trim().length < 2) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      findMembersForCaseAction(query)
        .then((rows) => {
          if (seq === searchSeq.current) setMatches(rows);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, addingPerson, requester]);

  const patient = requester?.household.find((h) => h.id === patientId) ?? null;
  const patientCovered = addingPerson ? np.isCovered : (patient?.isCovered ?? true);

  // ---- contact
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("PHONE");
  const [contactedAt, setContactedAt] = useState(() => toDueInput(new Date()));
  // Phone and walk-in are usually handled there and then; an email or
  // WhatsApp often still needs a reply. Until staff pick one themselves.
  const [status, setStatus] = useState<"NEW" | "IN_PROGRESS">("IN_PROGRESS");
  const [statusTouched, setStatusTouched] = useState(false);
  const chooseChannel = (c: (typeof CHANNELS)[number]) => {
    setChannel(c);
    if (!statusTouched) setStatus(c === "PHONE" || c === "WALK_IN" ? "IN_PROGRESS" : "NEW");
  };

  // ---- request
  const [categoryId, setCategoryId] = useState("");
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]>("THIS_WEEK");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [location, setLocation] = useState("");

  function pickPerson(m: MemberMatch, personId: string) {
    setRequester(m);
    setPatientId(personId);
    const person = m.household.find((h) => h.id === personId);
    if (!contactPhone) setContactPhone(m.phone ?? person?.phone ?? "");
    if (person && !person.isCovered && coverage === "COVERED") setCoverage("SPECIAL_FREE");
  }

  // ---- cover, colour, handling
  const [coverage, setCoverage] = useState<(typeof COVERAGES)[number]>("COVERED");
  const effectiveCoverage = !patientCovered && coverage === "COVERED" ? "SPECIAL_FREE" : coverage;
  const category = categories.find((c) => c.id === categoryId);
  const suggestion = initialRag({ urgency, categoryCode: category?.code ?? "", description, hasLocation: Boolean(location.trim()) });
  const [colour, setColour] = useState<Rag | "">("");
  const [colourReason, setColourReason] = useState("");
  const chosenColour = colour || suggestion.rag;
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState("");
  const [withAction, setWithAction] = useState(false);

  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(createStaffCaseAction, null);
  const createdId = state?.success ? state.data?.id : undefined;
  useEffect(() => {
    if (createdId) router.push(`/cases/${createdId}`);
  }, [createdId, router]);
  const errors = state && !state.success ? state.errors : {};
  const err = (field: string) => {
    const code = errors[field]?.[0];
    return code ? <span className="text-[11.5px] font-normal tracking-normal text-[#b91c1c] normal-case">{tn(`error.${code}`)}</span> : null;
  };
  const errorCount = Object.keys(errors).length;

  const relation = (h: MemberMatch["household"][number]) => (h.isPrimary ? tn("primaryMember") : (localizedText(h.relationshipEn, h.relationshipFr, locale) ?? tn("dependent")));

  return (
    <form
      // Submitted by hand rather than with `action`: a form action resets the
      // form afterwards, which clears selects (request type…) even though
      // they're controlled — and a failed save must keep everything.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex max-w-3xl flex-col gap-5 px-5 py-5"
    >
      {/* ------------------------------------------------ 1. who */}
      <Section n={1} title={tn("whoTitle")}>
        {addingPerson ? (
          <div className="flex flex-col gap-3 border-2 border-pn-ink bg-white p-3">
            <input type="hidden" name="addNewPerson" value="1" />
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
                <UserPlus size={14} aria-hidden /> {tn("newPersonTitle")}
              </span>
              <button type="button" onClick={() => setAddingPerson(false)} className="cursor-pointer text-[12px] font-semibold text-pn-gray-2 hover:text-pn-ink">
                {tn("backToSearch")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["firstName", "text", true],
                  ["lastName", "text", true],
                  ["dateOfBirth", "date", false],
                  ["phone", "tel", false],
                  ["email", "email", false],
                ] as const
              ).map(([key, type, required]) => (
                <label key={key} className={labelClass}>
                  {tn(`np.${key}`)}
                  <input
                    name={`np_${key}`}
                    type={type}
                    required={required}
                    value={np[key]}
                    onChange={(e) => {
                      setNp((p) => ({ ...p, [key]: e.target.value }));
                      if (key === "phone" && !contactPhone) setContactPhone(e.target.value);
                    }}
                    className={`${inputClass} tracking-normal normal-case`}
                  />
                  {err(`newPerson.${key}`)}
                </label>
              ))}
              <label className={labelClass}>
                {tn("np.preferredLanguage")}
                <select name="np_preferredLanguage" value={np.preferredLanguage} onChange={(e) => setNp((p) => ({ ...p, preferredLanguage: e.target.value }))} className={`${inputClass} tracking-normal normal-case`}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className={labelClass}>
                {tn("np.country")}
                <select name="np_countryId" value={np.countryId} onChange={(e) => setNp((p) => ({ ...p, countryId: e.target.value }))} className={`${inputClass} tracking-normal normal-case`}>
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={labelClass}>
              {tn("np.cover")}
              <input type="hidden" name="np_isCovered" value={np.isCovered ? "1" : "0"} />
              <Choice
                label={tn("np.cover")}
                value={np.isCovered ? "yes" : "no"}
                onChange={(v) => {
                  setNp((p) => ({ ...p, isCovered: v === "yes" }));
                  if (v === "no" && coverage === "COVERED") setCoverage("SPECIAL_FREE");
                }}
                options={[
                  { id: "no", label: tn("np.notCovered") },
                  { id: "yes", label: tn("np.covered") },
                ]}
              />
              <span className="text-[11.5px] tracking-normal normal-case">{np.isCovered ? tn("np.coveredHint") : tn("np.notCoveredHint")}</span>
            </div>
          </div>
        ) : requester ? (
          <div className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-3">
            <input type="hidden" name="requesterId" value={requester.id} />
            <input type="hidden" name="patientId" value={patientId} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-bold">
                  {requester.name} <span className="font-normal text-pn-gray-3 tabular-nums">{formatMemberNumber(requester.memberNumber)}</span>
                </div>
                <div className="text-[12px] text-pn-gray-2">{[requester.organization ?? tn("individual"), requester.phone, requester.email].filter(Boolean).join(" · ")}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequester(null);
                  setPatientId("");
                }}
                className="flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-pn-gray-2 hover:text-pn-ink"
              >
                <X size={13} aria-hidden /> {tn("change")}
              </button>
            </div>
            <div className={labelClass}>
              {tn("helpFor")}
              <div role="radiogroup" aria-label={tn("helpFor")} className="flex flex-col gap-1">
                {requester.household.map((h) => (
                  <label key={h.id} className="flex cursor-pointer items-center gap-2 text-[13px] tracking-normal text-pn-ink normal-case">
                    <input type="radio" name="patientChoice" checked={patientId === h.id} onChange={() => pickPerson(requester, h.id)} className="accent-pn-ink" />
                    <span className="font-semibold">{h.name}</span>
                    <span className="text-pn-gray-2">· {relation(h)}</span>
                    {!h.isCovered && <span className="bg-[#fde8d0] px-1.5 text-[10.5px] font-bold text-[#9a3412] uppercase">{tn("notCovered")}</span>}
                  </label>
                ))}
              </div>
              {err("patientId")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              {tn("findMember")}
              <span className="relative flex items-center">
                <Search size={14} className="absolute left-2 text-pn-gray-3" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim().length < 2) setMatches(null);
                  }}
                  placeholder={tn("findMemberPlaceholder")}
                  autoComplete="off"
                  className={`${inputClass} w-full pl-7 tracking-normal normal-case`}
                />
              </span>
              {err("requesterId")}
            </label>
            {searching && <p className="m-0 text-[12px] text-pn-gray-3">{tn("searching")}</p>}
            {matches && !searching && (
              <ul className="m-0 flex list-none flex-col border border-pn-rule bg-white p-0">
                {matches.length === 0 && <li className="px-3 py-2 text-[12.5px] text-pn-gray-3">{tn("noMatch")}</li>}
                {matches.map((m) => (
                  <li key={m.id} className="border-b border-pn-rule last:border-b-0">
                    <button type="button" onClick={() => pickPerson(m, m.id)} className="flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left hover:bg-pn-surface-hover">
                      <span className="text-[13px] font-semibold">
                        {m.name} <span className="font-normal text-pn-gray-3 tabular-nums">{formatMemberNumber(m.memberNumber)}</span>
                        {!m.isCovered && <span className="ml-2 bg-[#fde8d0] px-1.5 text-[10.5px] font-bold text-[#9a3412] uppercase">{tn("notCovered")}</span>}
                      </span>
                      <span className="text-[12px] text-pn-gray-2">{[m.organization ?? tn("individual"), m.phone, m.email].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setAddingPerson(true)} className="flex cursor-pointer items-center gap-1 self-start text-[12.5px] font-semibold text-[#0a5c3c] hover:underline">
              <UserPlus size={13} aria-hidden /> {tn("addNewPerson")}
            </button>
          </div>
        )}
      </Section>

      {/* ------------------------------------------------ 2. contact */}
      <Section n={2} title={tn("contactTitle")}>
        <div className={labelClass}>
          {tn("channel")}
          <input type="hidden" name="channel" value={channel} />
          <Choice
            label={tn("channel")}
            value={channel}
            onChange={chooseChannel}
            options={CHANNELS.map((c) => ({ id: c, label: <><ChannelIcon channel={c} label="" size={13} /> {t(`channel.${c}`)}</> }))}
          />
        </div>
        <label className={`${labelClass} w-fit`}>
          {tn("contactedAt")}
          <span className="flex items-center gap-2">
            <input type="datetime-local" name="contactedAt" required value={contactedAt} onChange={(e) => setContactedAt(e.target.value)} className={`${inputClass} tracking-normal normal-case`} />
            <button type="button" onClick={() => setContactedAt(toDueInput(new Date()))} className="cursor-pointer border border-pn-border-muted bg-white px-1.5 py-0.5 text-[11.5px] font-semibold tracking-normal normal-case hover:border-pn-ink">
              {tn("now")}
            </button>
            <span className="text-[11.5px] tracking-normal text-pn-gray-3 normal-case">{t("dakarTime")}</span>
          </span>
          <span className="text-[11.5px] tracking-normal normal-case">{tn("contactedAtHint")}</span>
          {err("contactedAt")}
        </label>
      </Section>

      {/* ------------------------------------------------ 3. request */}
      <Section n={3} title={tn("requestTitle")}>
        <label className={`${labelClass} w-fit`}>
          {tn("category")}
          <select name="categoryId" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputClass} tracking-normal normal-case`}>
            <option value="">{tn("chooseCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {err("categoryId")}
        </label>
        <div className={labelClass}>
          {tn("urgency")}
          <input type="hidden" name="urgency" value={urgency} />
          <Choice label={tn("urgency")} value={urgency} onChange={setUrgency} options={URGENCIES.map((u) => ({ id: u, label: tm(`urgency.${u}`) }))} />
        </div>
        <label className={labelClass}>
          {tn("description")}
          <textarea
            name="description"
            required
            rows={5}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tn(`descriptionPlaceholder.${channel}`)}
            spellCheck
            className="border-2 border-pn-border-muted bg-white p-2 text-[13.5px] tracking-normal text-pn-ink normal-case outline-none focus:border-pn-ink"
          />
          {err("description")}
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            {tn("callback")}
            <input name="contactPhone" type="tel" required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+221 77 …" className={`${inputClass} tracking-normal normal-case`} />
            {err("contactPhone")}
          </label>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[13px]">
            <input type="checkbox" name="contactHasWhatsapp" value="1" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="h-4 w-4 accent-pn-ink" />
            {tn("hasWhatsapp")}
          </label>
          <label className={`${labelClass} min-w-[220px] flex-1`}>
            {tn("location")}
            <input name="locationLabel" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tn("locationPlaceholder")} className={`${inputClass} tracking-normal normal-case`} />
          </label>
        </div>
      </Section>

      {/* ------------------------------------------------ 4. cover and colour */}
      <Section n={4} title={tn("coverTitle")}>
        <div className={labelClass}>
          {tn("coverage")}
          <input type="hidden" name="coverage" value={effectiveCoverage} />
          <Choice
            label={tn("coverage")}
            value={effectiveCoverage}
            onChange={setCoverage}
            disabled={patientCovered ? [] : ["COVERED"]}
            options={COVERAGES.map((c) => ({ id: c, label: t(`coverage.${c}`) }))}
          />
          <span className="text-[11.5px] tracking-normal normal-case">{!patientCovered ? tn("coverageNotCoveredHint") : effectiveCoverage === "SPECIAL_PAID" ? tn("coveragePaidHint") : effectiveCoverage === "SPECIAL_FREE" ? tn("coverageFreeHint") : ""}</span>
          {err("coverage")}
        </div>
        <div className={labelClass}>
          {tn("colour")}
          <span className="flex flex-wrap items-center gap-2 text-[12.5px] tracking-normal text-pn-ink normal-case">
            <span className={`px-2 py-px text-[11px] font-bold uppercase ${COLOUR_STYLE[suggestion.rag].pill}`}>{t(`colour.${suggestion.rag}`)}</span>
            <span className="text-pn-gray-2">{suggestion.reasons.length ? suggestion.reasons.map((r) => t(`reason.${r}`)).join(" · ") : tn("routine")}</span>
            <span className="text-pn-gray-3">· {tn("suggestedByRules")}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select name="colourRag" value={colour} onChange={(e) => setColour(e.target.value as Rag | "")} aria-label={tn("changeColour")} className={`${inputClass} tracking-normal normal-case`}>
              <option value="">{tn("keepSuggestion")}</option>
              {COLOURS.map((c) => (
                <option key={c} value={c}>
                  {t(`colour.${c}`)}
                </option>
              ))}
            </select>
            {chosenColour !== suggestion.rag && (
              <input name="colourReason" required value={colourReason} onChange={(e) => setColourReason(e.target.value)} placeholder={tn("colourReason")} aria-label={tn("colourReason")} className={`${inputClass} min-w-[260px] flex-1 tracking-normal normal-case`} />
            )}
          </div>
          {err("colourReason")}
        </div>
      </Section>

      {/* ------------------------------------------------ 5. handling */}
      <Section n={5} title={tn("handlingTitle")}>
        <div className={labelClass}>
          {tn("statusNow")}
          <input type="hidden" name="status" value={status} />
          <Choice
            label={tn("statusNow")}
            value={status}
            onChange={(s) => {
              setStatus(s);
              setStatusTouched(true);
            }}
            options={[
              { id: "IN_PROGRESS", label: tn("statusInProgress") },
              { id: "NEW", label: tn("statusNew") },
            ]}
          />
          <span className="text-[11.5px] tracking-normal normal-case">{status === "NEW" ? tn("statusNewHint") : tn("statusInProgressHint")}</span>
        </div>
        <div className={labelClass}>
          <span aria-hidden>{t("assignedTo")}</span>
          <AssigneePicker workers={workers} defaultId={meId} meId={meId} />
          {err("assigneeId")}
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-[13px]">
          <input type="checkbox" name="visibleToMember" value="1" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="mt-0.5 h-4 w-4 accent-pn-ink" />
          <span>
            <span className="font-semibold">{tn("showInApp")}</span>
            <span className="block text-[12px] text-pn-gray-2">{visible ? tn("showInAppOn") : tn("showInAppOff")}</span>
          </span>
        </label>
      </Section>

      {/* ------------------------------------------------ 6. first note / action */}
      <Section n={6} title={tn("extrasTitle")}>
        <label className={labelClass}>
          {tn("firstNote")}
          <textarea
            name="note"
            rows={3}
            maxLength={4000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={effectiveCoverage === "SPECIAL_PAID" ? tn("firstNotePaidPlaceholder") : tn("firstNotePlaceholder")}
            className="border-2 border-[#e8c98a] bg-white p-2 text-[13.5px] tracking-normal text-pn-ink normal-case outline-none focus:border-[#b45309]"
          />
          {err("note")}
        </label>
        {withAction ? (
          <div className="flex flex-col gap-2 border-l-4 border-pn-ink bg-white p-2">
            <input type="hidden" name="withAction" value="1" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.06em] uppercase">{t("actionWithNote")}</span>
              <button type="button" onClick={() => setWithAction(false)} aria-label={t("actionRemoveFromNote")} className="cursor-pointer text-pn-gray-2 hover:text-pn-ink">
                <X size={14} aria-hidden />
              </button>
            </div>
            <ActionFields workers={workers} meId={meId} defaultOwnerId={meId} errors={errors} />
          </div>
        ) : (
          <button type="button" onClick={() => setWithAction(true)} className="flex cursor-pointer items-center gap-1 self-start text-[12.5px] font-semibold text-pn-ink hover:underline">
            <ListPlus size={13} aria-hidden /> {tn("addFirstAction")}
          </button>
        )}
      </Section>

      {errorCount > 0 && (
        <p role="alert" className="m-0 border-l-4 border-[#b91c1c] bg-[#fdecec] px-3 py-2 text-[13px] font-semibold text-[#991b1b]">
          {tn("fixErrors", { count: errorCount })}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || Boolean(createdId)} className="h-9 cursor-pointer bg-pn-accent px-4 text-[13px] font-semibold text-white hover:bg-pn-accent-hover disabled:opacity-50">
          {pending || createdId ? tn("opening") : tn("open")}
        </button>
        <span className="text-[12px] text-pn-gray-2">{tn(`openHint.${effectiveCoverage}`)}</span>
      </div>
    </form>
  );
}
