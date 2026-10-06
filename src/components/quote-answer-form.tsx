"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Snowflake } from "lucide-react";
import type { QuoteFormState } from "@/app/[locale]/q/actions";

export type QuoteItem = { id: string; label: string; brand: string | null; quantity: number; narcotic: boolean; cold: boolean };
type LineState = { availability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | ""; quantityOffered: string; price: string; pack: string; units: string; substitution: string };
export type QuoteInitial = {
  preparationMinutes: number | null;
  canDispenseNarcotic: boolean | null;
  canPackColdChain: boolean | null;
  pharmacistName: string | null;
  note: string | null;
  lines: { orderLineId: string; availability: string; quantityOffered: number | null; packPriceXof: number | null; packDescription: string | null; unitsPerPack: number | null; substitution: string | null }[];
};

const PREP = [10, 20, 30, 45, 60, 90, 120];

/** A pharmacy's answer: for each item available / partly / unavailable,
 * price per pack (FCFA) and pack size, an optional substitution; then
 * preparation time and the confirmations the order needs. Used on the
 * pharmacy's private quote page and by staff entering a phoned answer. */
export function QuoteAnswerForm({
  items,
  needsNarcotic,
  needsCold,
  initial,
  action,
  hidden,
  compact = false,
  onDone,
}: {
  items: QuoteItem[];
  needsNarcotic: boolean;
  needsCold: boolean;
  initial: QuoteInitial | null;
  action: (prev: QuoteFormState, fd: FormData) => Promise<QuoteFormState>;
  hidden: Record<string, string>;
  compact?: boolean;
  onDone?: () => void;
}) {
  const t = useTranslations("Quote");
  const [state, dispatch, pending] = useActionState<QuoteFormState, FormData>(action, null);
  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((it) => {
        const prev = initial?.lines.find((l) => l.orderLineId === it.id);
        return [
          it.id,
          {
            availability: (prev?.availability as LineState["availability"]) ?? "",
            quantityOffered: prev?.availability === "PARTIAL" && prev.quantityOffered ? String(prev.quantityOffered) : "",
            price: prev?.packPriceXof ? String(prev.packPriceXof) : "",
            pack: prev?.packDescription ?? "",
            units: prev?.unitsPerPack ? String(prev.unitsPerPack) : "",
            substitution: prev?.substitution ?? "",
          },
        ];
      }),
    ),
  );
  const [prep, setPrep] = useState(initial?.preparationMinutes != null ? String(initial.preparationMinutes) : "");
  const [narcotic, setNarcotic] = useState(Boolean(initial?.canDispenseNarcotic));
  const [cold, setCold] = useState(Boolean(initial?.canPackColdChain));
  const [name, setName] = useState(initial?.pharmacistName ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  // Tells the parent (e.g. to close the panel) after a save — in an effect,
  // since updating another component while this one renders isn't allowed.
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  const set = (id: string, patch: Partial<LineState>) => setLines((ls) => ({ ...ls, [id]: { ...ls[id], ...patch } }));
  const num = (v: string) => (v.trim() ? Number(v.replace(/[^\d]/g, "")) : undefined);

  function send(decline: boolean) {
    setLocalError(null);
    let answer: object;
    if (decline) answer = { decline: true, pharmacistName: name || undefined, note: note || undefined };
    else {
      if (items.some((it) => !lines[it.id].availability)) return setLocalError("chooseEach");
      if (!prep) return setLocalError("prep");
      answer = {
        decline: false,
        preparationMinutes: Number(prep),
        canDispenseNarcotic: needsNarcotic ? narcotic : undefined,
        canPackColdChain: needsCold ? cold : undefined,
        pharmacistName: name || undefined,
        note: note || undefined,
        lines: items.map((it) => {
          const l = lines[it.id];
          return {
            orderLineId: it.id,
            availability: l.availability,
            quantityOffered: l.availability === "PARTIAL" ? num(l.quantityOffered) : undefined,
            packPriceXof: l.availability === "UNAVAILABLE" ? undefined : num(l.price),
            packDescription: l.pack || undefined,
            unitsPerPack: num(l.units),
            substitution: l.substitution || undefined,
          };
        }),
      };
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    fd.set("answer", JSON.stringify(answer));
    startTransition(() => dispatch(fd));
  }

  if (state?.ok && !compact) {
    return (
      <div role="status" className="flex flex-col gap-2 border-2 border-pn-accent bg-pn-accent-soft p-4">
        <p className="m-0 flex items-center gap-2 text-[17px] font-bold text-[#08432c]">
          <CheckCircle2 size={20} aria-hidden /> {state.declined ? t("declinedThanks") : t("thanks")}
        </p>
        <p className="m-0 text-[15px]">{t("thanksBody")}</p>
      </div>
    );
  }

  const error = localError ?? (state && !state.ok ? state.error : null);
  const input = `border-2 border-pn-border-muted bg-white px-2 outline-none focus:border-pn-ink ${compact ? "h-8 text-[13px]" : "h-11 text-[16px]"}`;
  const avail = ["AVAILABLE", "PARTIAL", "UNAVAILABLE"] as const;

  return (
    <div className={`flex flex-col ${compact ? "gap-3" : "gap-5"}`}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((it, i) => {
          const l = lines[it.id];
          return (
            <li key={it.id} className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="flex flex-col">
                  <span className={`font-bold ${compact ? "text-[13.5px]" : "text-[16px]"}`}>
                    {i + 1}. {it.label}
                  </span>
                  <span className="text-[13px] text-pn-gray-2">
                    {it.brand ? `${it.brand} · ` : ""}
                    {t("quantityAsked", { count: it.quantity })}
                  </span>
                  <span className="flex gap-1">
                    {it.narcotic && <span className="bg-[#c62828] px-1.5 text-[11px] font-bold text-white">{t("narcotic")}</span>}
                    {it.cold && (
                      <span className="flex items-center gap-0.5 bg-[#e0f2fe] px-1.5 text-[11px] font-bold text-[#075985]">
                        <Snowflake size={10} aria-hidden /> {t("cold")}
                      </span>
                    )}
                  </span>
                </span>
              </div>
              <div role="radiogroup" aria-label={t("availability", { item: it.label })} className="grid grid-cols-3 gap-1.5">
                {avail.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={l.availability === a}
                    onClick={() => set(it.id, { availability: a })}
                    className={`cursor-pointer border-2 px-1 font-semibold ${compact ? "h-8 text-[12px]" : "h-11 text-[14px]"} ${
                      l.availability === a ? (a === "UNAVAILABLE" ? "border-[#b91c1c] bg-[#fdecec] text-[#991b1b]" : "border-pn-ink bg-pn-ink text-white") : "border-pn-border-muted bg-white"
                    }`}
                  >
                    {t(`avail.${a}`)}
                  </button>
                ))}
              </div>
              {(l.availability === "AVAILABLE" || l.availability === "PARTIAL") && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-pn-gray-1">
                    {t("pricePerPack")}
                    <input inputMode="numeric" value={l.price} onChange={(e) => set(it.id, { price: e.target.value })} placeholder="FCFA" className={input} />
                  </label>
                  {l.availability === "PARTIAL" && (
                    <label className="flex flex-col gap-1 text-[12px] font-semibold text-pn-gray-1">
                      {t("howMany")}
                      <input inputMode="numeric" value={l.quantityOffered} onChange={(e) => set(it.id, { quantityOffered: e.target.value })} className={input} />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-pn-gray-1">
                    {t("pack")}
                    <input value={l.pack} onChange={(e) => set(it.id, { pack: e.target.value })} placeholder={t("packPlaceholder")} className={input} />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-pn-gray-1">
                    {t("unitsPerPack")}
                    <input inputMode="numeric" value={l.units} onChange={(e) => set(it.id, { units: e.target.value })} placeholder="16" className={input} />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold text-pn-gray-1">
                    {t("substitution")}
                    <input value={l.substitution} onChange={(e) => set(it.id, { substitution: e.target.value })} placeholder={t("substitutionPlaceholder")} className={input} />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        {t("prepTime")}
        <select value={prep} onChange={(e) => setPrep(e.target.value)} className={input}>
          <option value="">{t("choose")}</option>
          {PREP.map((m) => (
            <option key={m} value={m}>
              {t("minutes", { m })}
            </option>
          ))}
        </select>
      </label>
      {needsNarcotic && (
        <label className="flex cursor-pointer items-start gap-2 text-[14px]">
          <input type="checkbox" checked={narcotic} onChange={(e) => setNarcotic(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-pn-ink" /> {t("confirmNarcotic")}
        </label>
      )}
      {needsCold && (
        <label className="flex cursor-pointer items-start gap-2 text-[14px]">
          <input type="checkbox" checked={cold} onChange={(e) => setCold(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-pn-ink" /> {t("confirmCold")}
        </label>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          {t("pharmacistName")}
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          {t("note")}
          <input value={note} onChange={(e) => setNote(e.target.value)} className={input} />
        </label>
      </div>
      {error && (
        <p role="alert" className="m-0 font-semibold text-[#b91c1c]">
          {t.has(`error.${error}`) ? t(`error.${error}`) : t("error.invalid")}
        </p>
      )}
      {state?.ok && compact && <p className="m-0 font-semibold text-[#0a5c3c]">{t("saved")}</p>}
      <div className={`flex flex-col gap-2 ${compact ? "sm:flex-row" : ""}`}>
        <button type="button" disabled={pending} onClick={() => send(false)} className={`cursor-pointer bg-pn-accent font-extrabold text-white disabled:opacity-50 ${compact ? "h-9 px-4 text-[13px]" : "h-14 text-[17px]"}`}>
          {pending ? t("sending") : t("send")}
        </button>
        <button type="button" disabled={pending} onClick={() => send(true)} className={`cursor-pointer border-2 border-[#b91c1c] bg-white font-semibold text-[#991b1b] disabled:opacity-50 ${compact ? "h-9 px-4 text-[13px]" : "h-12 text-[15px]"}`}>
          {t("decline")}
        </button>
      </div>
    </div>
  );
}
