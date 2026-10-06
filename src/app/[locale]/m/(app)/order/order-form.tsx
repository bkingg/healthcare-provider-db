"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, FileText, Info, LocateFixed, Minus, Plus, Search, Snowflake, Trash2, X } from "lucide-react";
import { requirementsFor, type RegulatoryClass } from "@/lib/medications";
import { shrinkImage } from "@/lib/shrinkImage";
import type { ActionResult } from "@/lib/validation/common";
import { placeMedicationOrderAction, searchMedicationsAction } from "../../actions";

type Person = { id: string; name: string; detail: string };
type Med = Awaited<ReturnType<typeof searchMedicationsAction>>[number];
export type OrderRule = { code: string; name: string; description: string | null; appliesTo: string; kind: string; sortOrder: number; isActive: boolean };
type Line = { key: string; med?: Med; freeText?: string; quantity: number };
type Upload = { key: string; requirementCode: string; name: string; status: "uploading" | "done" | "error"; fileId?: string; error?: string; preview?: string };

const WHEN = ["TODAY", "THIS_WEEK", "ROUTINE"] as const;
const MAX_LINES = 15;
const MAX_QTY = 20;

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-3 flex items-center gap-2 p-0 text-[17px] font-bold">
        <span className="flex h-7 w-7 items-center justify-center bg-pn-ink text-[14px] text-white">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function ChoiceCard({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 border-2 px-4 py-3 ${checked ? "border-pn-ink bg-pn-accent-soft" : "border-pn-border-muted bg-white"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`flex h-5 w-5 flex-none items-center justify-center border-2 ${checked ? "border-pn-ink bg-pn-ink text-white" : "border-pn-border-muted"}`} aria-hidden>
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-col">{children}</span>
    </label>
  );
}

function MedBadges({ m, t }: { m: Pick<Med, "regulatoryClass" | "prescriptionRequired" | "isColdChain" | "isPsychotropic">; t: (k: string) => string }) {
  const rx = m.prescriptionRequired || m.regulatoryClass !== "NOT_LISTED";
  return (
    <span className="flex flex-wrap gap-1">
      {m.regulatoryClass === "NARCOTIC" && <span className="bg-[#c62828] px-1.5 text-[11px] font-bold text-white">{t("badgeNarcotic")}</span>}
      {rx && m.regulatoryClass !== "NARCOTIC" && <span className="border border-pn-ink px-1.5 text-[11px] font-bold">{t("badgeRx")}</span>}
      {m.isColdChain && (
        <span className="flex items-center gap-0.5 bg-[#e0f2fe] px-1.5 text-[11px] font-bold text-[#075985]">
          <Snowflake size={10} aria-hidden /> {t("badgeCold")}
        </span>
      )}
    </span>
  );
}

const medName = (m: Med) => [m.dci, m.strength, m.form].filter(Boolean).join(" ");

/** The member's medication order: who it's for, what (from the catalog, or
 * "not in the list"), the documents those items need — photos upload as
 * soon as they're taken, shrunk on the phone — and where to deliver. */
export function OrderForm({ people, rules, defaultPhone, defaultAddress }: { people: Person[]; rules: OrderRule[]; defaultPhone: string; defaultAddress: string }) {
  const t = useTranslations("MemberOrder");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(placeMedicationOrderAction, null);
  const errors = state && !state.success ? state.errors : {};
  const err = (key: string) => {
    const code = errors[key]?.[0];
    return code ? <p className="m-0 text-[14px] text-[#b91c1c]">{t.has(`error.${code}`) ? t(`error.${code}`) : code}</p> : null;
  };

  const [patientId, setPatientId] = useState(people.length === 1 ? people[0].id : "");
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [searching, setSearching] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [showFree, setShowFree] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [when, setWhen] = useState<(typeof WHEN)[number] | "">("");
  const [address, setAddress] = useState(defaultAddress);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [whatsapp, setWhatsapp] = useState(false);
  const [note, setNote] = useState("");

  // Search as the member types (after a short pause); the latest answer wins.
  const seq = useRef(0);
  // Keys for added items and uploads.
  const nextKey = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      searchMedicationsAction(q)
        .then((r) => {
          if (mine === seq.current) setResults(r);
        })
        .finally(() => {
          if (mine === seq.current) setSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const catalogItems = lines.flatMap((l) => (l.med ? [l.med] : []));
  const needed = requirementsFor(
    catalogItems.map((m) => ({ regulatoryClass: m.regulatoryClass as RegulatoryClass, isPsychotropic: m.isPsychotropic, isColdChain: m.isColdChain, prescriptionRequired: m.prescriptionRequired })),
    rules,
  );
  // A free-text item might need a prescription: offer the upload, optional.
  const optionalRx = lines.some((l) => l.freeText) && !needed.some((r) => r.appliesTo === "PRESCRIPTION_REQUIRED") ? rules.find((r) => r.appliesTo === "PRESCRIPTION_REQUIRED") : undefined;
  const docRules = [...needed, ...(optionalRx ? [optionalRx] : [])];

  function addMed(m: Med) {
    if (lines.length >= MAX_LINES) return;
    setLines((ls) => (ls.some((l) => l.med?.id === m.id) ? ls.map((l) => (l.med?.id === m.id ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + 1) } : l)) : [...ls, { key: m.id, med: m, quantity: 1 }]));
    setQuery("");
    setResults([]);
  }
  function addFree() {
    const text = freeText.trim();
    if (text.length < 2 || lines.length >= MAX_LINES) return;
    const key = `free-${++nextKey.current}`;
    setLines((ls) => [...ls, { key, freeText: text, quantity: 1 }]);
    setFreeText("");
    setShowFree(false);
  }
  const setQty = (key: string, q: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(MAX_QTY, q)) } : l)));

  async function upload(requirementCode: string, file: File) {
    const key = `${requirementCode}-${++nextKey.current}`;
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setUploads((u) => [...u, { key, requirementCode, name: file.name, status: "uploading", preview }]);
    try {
      const small = await shrinkImage(file);
      const body = new FormData();
      body.set("file", small);
      const res = await fetch("/api/m/uploads", { method: "POST", body });
      const json = (await res.json()) as { id?: string; error?: string };
      setUploads((u) => u.map((x) => (x.key === key ? (res.ok && json.id ? { ...x, status: "done", fileId: json.id } : { ...x, status: "error", error: json.error ?? "failed" }) : x)));
    } catch {
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: "error", error: "failed" } : x)));
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  const stillUploading = uploads.some((u) => u.status === "uploading");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const order = {
      patientId,
      lines: lines.map((l) => (l.med ? { medicationId: l.med.id, quantity: l.quantity } : { freeText: l.freeText!, quantity: l.quantity })),
      documents: uploads.filter((u) => u.status === "done" && docRules.some((r) => r.code === u.requirementCode)).map((u) => ({ requirementCode: u.requirementCode, fileId: u.fileId! })),
      acknowledged: acknowledged.filter((c) => docRules.some((r) => r.code === c)),
      when: when || undefined,
      deliveryAddress: address,
      ...(coords && { latitude: coords.lat, longitude: coords.lng }),
      deliveryNotes: deliveryNotes || undefined,
      contactPhone: phone,
      contactHasWhatsapp: whatsapp,
      note: note || undefined,
    };
    const fd = new FormData();
    fd.set("order", JSON.stringify(order));
    // Sent by hand, not with `action`: a form action resets the form after
    // it runs, and a failed attempt must keep everything entered.
    startTransition(() => action(fd));
  }

  const input = "h-12 border-2 border-pn-border-muted bg-white px-3 text-[16px] outline-none focus:border-pn-ink";
  return (
    <form onSubmit={submit} className="flex flex-col gap-8 px-4 py-6">
      <Section n={1} title={t("forWhom")}>
        {people.map((p) => (
          <ChoiceCard key={p.id} checked={patientId === p.id} onChange={() => setPatientId(p.id)}>
            <span className="text-[16px] font-semibold">{p.name}</span>
            {p.detail && <span className="text-[13px] text-pn-gray-2">{p.detail}</span>}
          </ChoiceCard>
        ))}
        {err("patientId")}
      </Section>

      <Section n={2} title={t("whichMedications")}>
        <label className="relative flex items-center">
          <Search size={18} className="absolute left-3 text-pn-gray-3" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            autoComplete="off"
            className={`${input} w-full pl-10`}
          />
        </label>
        {searching && <p className="m-0 text-[14px] text-pn-gray-3">{t("searching")}</p>}
        {!searching && query.trim().length >= 2 && results.length === 0 && <p className="m-0 text-[14px] text-pn-gray-2">{t("noMatch")}</p>}
        {results.length > 0 && (
          <ul className="m-0 flex list-none flex-col border-2 border-pn-ink bg-white p-0">
            {results.map((m) => (
              <li key={m.id} className="border-b border-pn-rule last:border-b-0">
                <button type="button" onClick={() => addMed(m)} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left active:bg-pn-surface-hover">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{medName(m)}</span>
                    {m.brandName && <span className="text-[13px] text-pn-gray-2">{m.brandName}</span>}
                    <MedBadges m={m} t={t} />
                  </span>
                  <Plus size={20} className="flex-none" aria-label={t("add")} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t("yourItems")}>
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 border-2 border-pn-ink bg-white px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{l.med ? medName(l.med) : l.freeText}</span>
                  {l.med ? (
                    <>
                      {l.med.brandName && <span className="text-[13px] text-pn-gray-2">{l.med.brandName}</span>}
                      <MedBadges m={l.med} t={t} />
                    </>
                  ) : (
                    <span className="text-[13px] text-pn-gray-2">{t("notInList")}</span>
                  )}
                </span>
                <span className="flex items-center gap-1" role="group" aria-label={t("quantity")}>
                  <button type="button" onClick={() => setQty(l.key, l.quantity - 1)} aria-label={t("less")} className="flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-pn-border-muted">
                    <Minus size={16} />
                  </button>
                  <span className="w-7 text-center text-[16px] font-bold tabular-nums">{l.quantity}</span>
                  <button type="button" onClick={() => setQty(l.key, l.quantity + 1)} aria-label={t("more")} className="flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-pn-border-muted">
                    <Plus size={16} />
                  </button>
                </span>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={t("remove")} className="cursor-pointer p-1 text-pn-gray-2">
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && <p className="m-0 text-[13px] text-pn-gray-2">{t("quantityHelp")}</p>}

        {showFree ? (
          <div className="flex flex-col gap-2 border-2 border-dashed border-pn-border-muted p-3">
            <label className="text-[14px] font-semibold" htmlFor="freeText">
              {t("notInListLabel")}
            </label>
            <div className="flex gap-2">
              <input id="freeText" value={freeText} maxLength={200} onChange={(e) => setFreeText(e.target.value)} placeholder={t("notInListPlaceholder")} className={`${input} min-w-0 flex-1`} />
              <button type="button" onClick={addFree} className="h-12 cursor-pointer bg-pn-ink px-4 text-[15px] font-semibold text-white">
                {t("add")}
              </button>
            </div>
            <p className="m-0 text-[13px] text-pn-gray-2">{t("notInListHelp")}</p>
          </div>
        ) : (
          <button type="button" onClick={() => setShowFree(true)} className="cursor-pointer self-start text-[15px] font-semibold text-[#0a5c3c] underline">
            {t("cantFind")}
          </button>
        )}
        {err("lines")}
      </Section>

      {docRules.length > 0 && (
        <Section n={3} title={t("documents")}>
          {docRules.map((r) => {
            const mine = uploads.filter((u) => u.requirementCode === r.code);
            const optional = r === optionalRx;
            return (
              <div key={r.code} className={`flex flex-col gap-2 border-2 p-3 ${r.kind === "HANDLING" ? "border-[#bae6fd] bg-[#f0f9ff]" : "border-pn-ink bg-white"}`}>
                <p className="m-0 flex items-center gap-2 text-[15px] font-bold">
                  {r.kind === "HANDLING" ? <Snowflake size={16} aria-hidden /> : r.kind === "ORIGINAL_TO_COLLECT" ? <Info size={16} aria-hidden /> : <FileText size={16} aria-hidden />}
                  {r.name}
                  {optional && <span className="text-[13px] font-normal text-pn-gray-2">({t("optional")})</span>}
                </p>
                {r.description && <p className="m-0 text-[14px] text-pn-gray-1">{r.description}</p>}
                {(r.kind === "UPLOAD" || r.kind === "ID_DOCUMENT") && (
                  <>
                    {mine.map((u) => (
                      <div key={u.key} className="flex items-center gap-2 border border-pn-rule px-2 py-1.5 text-[14px]">
                        {u.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.preview} alt="" className="h-10 w-10 flex-none object-cover" />
                        ) : (
                          <FileText size={20} className="flex-none" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                        <span className={u.status === "error" ? "font-semibold text-[#b91c1c]" : u.status === "done" ? "font-semibold text-[#0a5c3c]" : "text-pn-gray-2"}>
                          {u.status === "uploading" ? t("uploading") : u.status === "done" ? t("uploaded") : t(`uploadError.${u.error === "tooBig" || u.error === "type" || u.error === "tooMany" ? u.error : "failed"}`)}
                        </span>
                        <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))} aria-label={t("remove")} className="cursor-pointer p-1 text-pn-gray-2">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 border-2 border-pn-ink bg-white px-4 text-[15px] font-semibold">
                      <Camera size={18} aria-hidden /> {mine.length ? t("addAnotherPhoto") : t("addPhoto")}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void upload(r.code, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </>
                )}
                {r.kind === "ORIGINAL_TO_COLLECT" && (
                  <label className="flex cursor-pointer items-start gap-3 text-[15px]">
                    <input
                      type="checkbox"
                      checked={acknowledged.includes(r.code)}
                      onChange={(e) => setAcknowledged((a) => (e.target.checked ? [...a, r.code] : a.filter((c) => c !== r.code)))}
                      className="mt-0.5 h-5 w-5 flex-none accent-pn-ink"
                    />
                    {t("originalAck")}
                  </label>
                )}
                {err(`doc:${r.code}`)}
              </div>
            );
          })}
        </Section>
      )}

      <Section n={docRules.length > 0 ? 4 : 3} title={t("delivery")}>
        <label className="text-[14px] font-semibold" htmlFor="address">
          {t("address")}
        </label>
        <textarea id="address" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressPlaceholder")} className="border-2 border-pn-border-muted bg-white p-3 text-[16px] outline-none focus:border-pn-ink" />
        {err("deliveryAddress")}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating === "busy"}
          className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 border-2 px-4 text-[15px] font-semibold ${coords ? "border-pn-accent bg-pn-accent-soft text-[#08432c]" : "border-pn-ink bg-white"}`}
        >
          {coords ? <Check size={18} /> : <LocateFixed size={18} />}
          {coords ? t("locationShared") : locating === "busy" ? t("locating") : t("shareLocation")}
        </button>
        {locating === "denied" && <p className="m-0 text-[14px] text-pn-gray-1">{t("locationDenied")}</p>}
        <label className="text-[14px] font-semibold" htmlFor="deliveryNotes">
          {t("deliveryNotes")}
        </label>
        <input id="deliveryNotes" maxLength={300} value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder={t("deliveryNotesPlaceholder")} className={input} />

        <p className="m-0 mt-2 text-[15px] font-semibold">{t("whenNeeded")}</p>
        {WHEN.map((w) => (
          <ChoiceCard key={w} checked={when === w} onChange={() => setWhen(w)}>
            <span className="text-[15px] font-semibold">{t(`when.${w}`)}</span>
          </ChoiceCard>
        ))}
        {err("when")}

        <label className="mt-2 text-[14px] font-semibold" htmlFor="phone">
          {t("phone")}
        </label>
        <div className="flex items-stretch gap-2">
          <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" className={`${input} min-w-0 flex-1`} />
          <button
            type="button"
            role="switch"
            aria-checked={whatsapp}
            aria-label={t("hasWhatsapp")}
            onClick={() => setWhatsapp((v) => !v)}
            className={`flex h-12 flex-none cursor-pointer items-center gap-2 border-2 px-3 text-[14px] font-semibold ${whatsapp ? "border-[#128c4a] bg-[#e6f6ec] text-[#0b5a30]" : "border-pn-border-muted bg-white text-pn-gray-1"}`}
          >
            <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${whatsapp ? "bg-[#128c4a]" : "bg-pn-border-muted"}`} aria-hidden>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${whatsapp ? "left-[18px]" : "left-0.5"}`} />
            </span>
            WhatsApp
          </button>
        </div>
        {err("contactPhone")}
      </Section>

      <Section n={docRules.length > 0 ? 5 : 4} title={t("anythingElse")}>
        <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} aria-label={t("anythingElse")} className="border-2 border-pn-border-muted bg-white p-3 text-[16px] outline-none focus:border-pn-ink" />
      </Section>

      {err("form")}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="m-0 border-l-4 border-[#b91c1c] bg-[#fdecec] px-3 py-2 text-[14px] font-semibold text-[#991b1b]">
          {t("fixErrors")}
        </p>
      )}
      <button type="submit" disabled={pending || stillUploading || lines.length === 0} className="h-14 cursor-pointer bg-pn-accent text-[17px] font-extrabold text-white active:bg-pn-accent-hover disabled:opacity-50">
        {pending ? t("sending") : stillUploading ? t("waitUploads") : t("send")}
      </button>
      <p className="m-0 -mt-4 text-[13px] text-pn-gray-2">{t("whatHappensNext")}</p>
    </form>
  );
}
