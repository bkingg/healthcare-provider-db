"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronRight, Copy, MessageCircle, Plus, Star } from "lucide-react";
import { QuoteAnswerForm, type QuoteInitial, type QuoteItem } from "@/components/quote-answer-form";
import { addPharmacyAction, chooseQuoteAction, enterQuoteAnswerAction, sendQuoteAction } from "../actions";

export type PanelQuote = {
  id: string;
  providerName: string;
  providerCode: string;
  status: string;
  openNow: boolean;
  distanceKm: number | null;
  sentAt: string | null;
  answeredAt: string | null;
  expiresAt: string | null;
  hasPhone: boolean;
  enteredByStaff: boolean;
  initial: QuoteInitial | null;
  row: {
    eligible: boolean;
    reason: string | null;
    complete: boolean;
    covered: number;
    medicinesXof: number;
    deliveryXof: number;
    totalXof: number;
    doorMinutes: number;
    hasSubstitution: boolean;
  } | null;
};

export type PanelCandidate = { id: string; name: string; code: string; openNow: boolean; distanceKm: number | null };

const xof = (n: number) => n.toLocaleString("fr-FR");

/** The pharmacies asked about a medication order: send each a private
 * link on WhatsApp (or copy it), enter a phoned answer, add more
 * pharmacies, and see the answers compared — the best one marked, chosen
 * automatically once everyone has replied or the wait is over; staff can
 * choose another. */
export function PharmacyPanel({
  orderId,
  quotes,
  candidates,
  items,
  needsNarcotic,
  needsCold,
  chosenQuoteId,
  bestId,
  urgent,
  totalItems,
  partial,
  fasterButDearer,
}: {
  orderId: string;
  quotes: PanelQuote[];
  candidates: PanelCandidate[];
  items: QuoteItem[];
  needsNarcotic: boolean;
  needsCold: boolean;
  chosenQuoteId: string | null;
  bestId: string | null;
  urgent: boolean;
  totalItems: number;
  partial: { provider: string; missing: { label: string; elsewhere: string[] }[] } | null;
  fasterButDearer: { provider: string; percentMore: number } | null;
}) {
  const t = useTranslations("Pharmacies");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  async function send(q: PanelQuote, how: "whatsapp" | "copy") {
    setBusy(q.id);
    // Opened before the request, so the browser doesn't block it as a pop-up.
    const win = how === "whatsapp" ? window.open("about:blank", "_blank") : null;
    try {
      const r = await sendQuoteAction(q.id);
      if (how === "whatsapp" && r.whatsappUrl && win) win.location.href = r.whatsappUrl;
      else {
        win?.close();
        await navigator.clipboard.writeText(r.message).catch(() => {});
        setCopied(q.id);
      }
    } finally {
      setBusy(null);
    }
  }

  const answered = quotes.filter((q) => q.row && q.status === "ANSWERED");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("title")}</span>
        <span className="text-[11.5px] text-pn-gray-2">{urgent ? t("ruleUrgent") : t("ruleCheapest")}</span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {quotes.map((q) => (
          <li key={q.id} className={`flex flex-col gap-1.5 border px-3 py-2 ${q.id === chosenQuoteId ? "border-2 border-pn-accent bg-pn-accent-soft" : "border-pn-rule bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {q.id === chosenQuoteId && <Check size={13} className="text-[#0a5c3c]" aria-hidden />}
                  {q.providerName} <span className="font-normal text-pn-gray-3 tabular-nums">{q.providerCode}</span>
                </span>
                <span className="text-[11.5px] text-pn-gray-2">
                  <span className={q.openNow ? "font-semibold text-[#0a5c3c]" : "text-[#b45309]"}>{q.openNow ? t("open") : t("closed")}</span>
                  {q.distanceKm !== null && ` · ${q.distanceKm} km`} · <span className="font-semibold">{t(`status.${q.status}`)}</span>
                  {q.sentAt && q.status === "SENT" && ` · ${t("sentAt", { when: q.sentAt })}`}
                  {q.answeredAt && ` · ${t("answeredAt", { when: q.answeredAt })}`}
                  {q.enteredByStaff && ` · ${t("byPhone")}`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {(q.status === "PREPARED" || q.status === "SENT" || q.status === "EXPIRED") && (
                  <>
                    <button
                      type="button"
                      disabled={busy === q.id || !q.hasPhone}
                      title={q.hasPhone ? undefined : t("noPhone")}
                      onClick={() => send(q, "whatsapp")}
                      className="flex h-7 cursor-pointer items-center gap-1 border-2 border-[#128c4a] bg-white px-2 text-[11.5px] font-semibold text-[#0b5a30] disabled:opacity-40"
                    >
                      <MessageCircle size={12} aria-hidden /> {q.status === "PREPARED" ? t("sendWhatsapp") : t("resend")}
                    </button>
                    <button type="button" disabled={busy === q.id} onClick={() => send(q, "copy")} className="flex h-7 cursor-pointer items-center gap-1 border border-pn-border-muted bg-white px-2 text-[11.5px] font-semibold disabled:opacity-40">
                      <Copy size={12} aria-hidden /> {copied === q.id ? t("copied") : t("copyMessage")}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setEntering(entering === q.id ? null : q.id)} className="flex h-7 cursor-pointer items-center gap-1 px-1 text-[11.5px] font-semibold text-pn-gray-1 hover:underline">
                  {entering === q.id ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                  {q.status === "ANSWERED" || q.status === "DECLINED" ? t("editAnswer") : t("enterAnswer")}
                </button>
              </span>
            </div>
            {entering === q.id && (
              <div className="border-t border-pn-rule pt-2">
                <QuoteAnswerForm compact items={items} needsNarcotic={needsNarcotic} needsCold={needsCold} initial={q.initial} action={enterQuoteAnswerAction} hidden={{ quoteId: q.id }} onDone={() => setEntering(null)} />
              </div>
            )}
          </li>
        ))}
        {quotes.length === 0 && <li className="text-[12.5px] text-pn-gray-3">{t("none")}</li>}
      </ul>

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={t("addPharmacy")} className="h-8 max-w-[280px] border-2 border-pn-border-muted bg-white px-2 text-[12.5px]">
            <option value="">{t("addPharmacy")}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.openNow ? t("open") : t("closed")}
                {c.distanceKm !== null ? ` · ${c.distanceKm} km` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!adding || busy === "add"}
            onClick={async () => {
              setBusy("add");
              await addPharmacyAction(orderId, adding).finally(() => setBusy(null));
              setAdding("");
            }}
            className="flex h-8 cursor-pointer items-center gap-1 border-2 border-pn-ink bg-white px-2 text-[12px] font-semibold disabled:opacity-40"
          >
            <Plus size={12} aria-hidden /> {t("add")}
          </button>
        </div>
      )}

      {answered.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("comparison")}</span>
          {/* Compact rows rather than a table, so it fits the case page's
           * column at any width: pharmacy · total (medicines + delivery) ·
           * time to the door · action. */}
          <ul className="m-0 flex list-none flex-col border border-pn-rule bg-white p-0">
            {answered
              .sort((a, b) => Number(b.id === bestId) - Number(a.id === bestId) || Number(b.row!.eligible) - Number(a.row!.eligible) || a.row!.totalXof - b.row!.totalXof)
              .map((q) => {
                const r = q.row!;
                return (
                  <li
                    key={q.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto_auto_84px] items-center gap-3 border-b border-pn-rule px-2.5 py-2 text-[12px] last:border-b-0 ${q.id === bestId ? "bg-[#f0fdf4]" : ""} ${r.eligible ? "" : "text-pn-gray-3"}`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1 font-semibold">
                        {q.id === bestId && <Star size={12} className="flex-none fill-[#0a5c3c] text-[#0a5c3c]" aria-label={t("best")} />}
                        <span className="truncate" title={q.providerName}>
                          {q.providerName}
                        </span>
                      </span>
                      <span className="text-[11px]">
                        <span className={r.complete ? "" : "font-semibold text-[#b45309]"}>{t("itemsCount", { covered: r.covered, total: totalItems })}</span>
                        {r.hasSubstitution && <span className="font-semibold text-[#b45309]"> · {t("substitution")}</span>}
                      </span>
                    </span>
                    <span className="flex flex-col items-end tabular-nums">
                      <span className="text-[13px] font-bold whitespace-nowrap">{xof(r.totalXof)} FCFA</span>
                      <span className="text-[10.5px] whitespace-nowrap text-pn-gray-2">{t("breakdown", { medicines: xof(r.medicinesXof), delivery: xof(r.deliveryXof) })}</span>
                    </span>
                    <span className="text-right whitespace-nowrap tabular-nums">{t("minutesShort", { m: r.doorMinutes })}</span>
                    <span className="text-right">
                      {!r.eligible ? (
                        <span className="text-[10.5px] leading-tight">{t(`reason.${r.reason}`)}</span>
                      ) : q.id === chosenQuoteId ? (
                        <span className="text-[11px] font-bold text-[#0a5c3c]">{t("chosen")}</span>
                      ) : (
                        <form action={chooseQuoteAction}>
                          <input type="hidden" name="orderId" value={orderId} />
                          <input type="hidden" name="quoteId" value={q.id} />
                          <button type="submit" className="h-6 cursor-pointer border border-pn-ink bg-white px-2 text-[11px] font-semibold hover:bg-pn-surface-hover">
                            {t("choose")}
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
          <p className="m-0 text-[11px] text-pn-gray-3">{t("deliveryEstimateNote")}</p>
          {fasterButDearer && <p className="m-0 text-[12px] font-semibold text-[#b45309]">{t("fasterButDearer", { provider: fasterButDearer.provider, percent: fasterButDearer.percentMore })}</p>}
          {partial && (
            <div className="border-l-4 border-[#b45309] bg-[#fff7ed] px-2 py-1.5 text-[12px]">
              <p className="m-0 font-semibold">{t("noComplete", { provider: partial.provider })}</p>
              {partial.missing.map((m) => (
                <p key={m.label} className="m-0">
                  · {m.label}: {m.elsewhere.length ? t("availableAt", { names: m.elsewhere.join(", ") }) : t("nowhere")}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
