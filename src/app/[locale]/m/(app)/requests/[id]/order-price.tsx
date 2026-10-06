"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { reportPaymentAction, respondToPriceAction, type OrderStepState } from "../../../actions";

export type MemberPriceView = {
  caseId: string;
  reference: string;
  status: string;
  items: { label: string; quantity: number; unitXof: number; subtotalXof: number; substitution: string | null }[];
  unavailable: string[];
  medicinesXof: number;
  deliveryXof: number;
  feeXof: number;
  totalXof: number;
  validUntil: string | null;
  expired: boolean;
  links: { code: string; method: string; label: string; url: string }[];
  /** The latest payment the member reported. */
  payment: { status: string; method: string; note: string | null } | null;
};

/** Submits without React's automatic form reset (keeps what was typed if
 * the answer comes back with an error), including the pressed button. */
const submitTo = (dispatch: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  startTransition(() => dispatch(fd));
};
const xof = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** The member's price, approval and payment for a medication order. */
export function OrderPrice({ v }: { v: MemberPriceView }) {
  const t = useTranslations("MemberPay");
  const [decide, decideAction, deciding] = useActionState<OrderStepState, FormData>(respondToPriceAction, null);
  const [paid, paidAction, reporting] = useActionState<OrderStepState, FormData>(reportPaymentAction, null);
  const [declining, setDeclining] = useState(false);
  const [method, setMethod] = useState(v.links[0]?.method === "ORANGE_MONEY" ? "ORANGE_MONEY" : "WAVE");
  const [ref, setRef] = useState("");
  const error = (s: OrderStepState) => (s && !s.ok ? <p className="m-0 text-[14px] font-semibold text-[#b91c1c]">{t.has(`error.${s.error}`) ? t(`error.${s.error}`) : t("error.other")}</p> : null);

  const breakdown = (
    <div className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-3">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {v.items.map((i) => (
          <li key={i.label} className="flex flex-col">
            <span className="flex justify-between gap-2 text-[15px]">
              <span className="min-w-0">
                {i.label} <span className="text-pn-gray-2">× {i.quantity}</span>
              </span>
              <span className="flex-none font-semibold tabular-nums">{xof(i.subtotalXof)}</span>
            </span>
            {i.substitution && (
              <span className="flex items-start gap-1 text-[13px] font-semibold text-[#b45309]">
                <Info size={14} className="mt-0.5 flex-none" aria-hidden /> {t("substitution", { text: i.substitution })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {v.unavailable.length > 0 && <p className="m-0 text-[13px] text-pn-gray-1">{t("unavailable", { items: v.unavailable.join(", ") })}</p>}
      <div className="flex flex-col gap-0.5 border-t border-pn-rule pt-2 text-[14px] tabular-nums">
        <span className="flex justify-between">
          <span>{t("medicines")}</span>
          <span>{xof(v.medicinesXof)}</span>
        </span>
        <span className="flex justify-between">
          <span>{t("delivery")}</span>
          <span>{xof(v.deliveryXof)}</span>
        </span>
        <span className="flex justify-between">
          <span>{t("fee")}</span>
          <span>{xof(v.feeXof)}</span>
        </span>
        <span className="mt-1 flex justify-between text-[18px] font-extrabold">
          <span>{t("total")}</span>
          <span>{xof(v.totalXof)}</span>
        </span>
      </div>
    </div>
  );

  if (v.status === "AWAITING_APPROVAL") {
    if (decide?.ok) return <p className="m-0 font-semibold">{t("thanks")}</p>;
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px] font-semibold">{t("approveIntro")}</p>
        {breakdown}
        {v.expired ? (
          <p className="m-0 flex items-start gap-1.5 text-[14px] text-[#b45309]">
            <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden /> {t("expired")}
          </p>
        ) : (
          <>
            {v.validUntil && <p className="m-0 text-[13px] text-pn-gray-2">{t("validUntil", { when: v.validUntil })}</p>}
            <form onSubmit={submitTo(decideAction)} className="flex flex-col gap-2">
              <input type="hidden" name="caseId" value={v.caseId} />
              {declining && (
                <textarea name="reason" rows={2} maxLength={500} placeholder={t("declineReason")} aria-label={t("declineReason")} className="border-2 border-pn-border-muted bg-white p-2 text-[15px]" />
              )}
              {!declining && (
                <button type="submit" name="decision" value="approve" disabled={deciding} className="h-14 cursor-pointer bg-pn-accent text-[17px] font-extrabold text-white disabled:opacity-50">
                  {t("approve", { total: xof(v.totalXof) })}
                </button>
              )}
              {declining ? (
                <div className="flex gap-2">
                  <button type="submit" name="decision" value="decline" disabled={deciding} className="h-12 flex-1 cursor-pointer border-2 border-[#b91c1c] bg-white text-[15px] font-semibold text-[#991b1b]">
                    {t("confirmDecline")}
                  </button>
                  <button type="button" onClick={() => setDeclining(false)} className="h-12 cursor-pointer px-3 text-[15px] font-semibold text-pn-gray-1">
                    {t("back")}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setDeclining(true)} className="h-12 cursor-pointer border-2 border-pn-border-muted bg-white text-[15px] font-semibold text-pn-gray-1">
                  {t("decline")}
                </button>
              )}
              {error(decide)}
            </form>
          </>
        )}
      </div>
    );
  }

  if (v.status === "AWAITING_PAYMENT") {
    const reported = paid?.ok || v.payment?.status === "REPORTED";
    return (
      <div className="flex flex-col gap-3">
        {breakdown}
        {reported ? (
          <p role="status" className="m-0 flex items-start gap-1.5 border-l-4 border-pn-accent bg-pn-accent-soft px-3 py-2 text-[15px]">
            <CheckCircle2 size={18} className="mt-0.5 flex-none text-[#0a5c3c]" aria-hidden /> {t("checking")}
          </p>
        ) : (
          <>
            {v.payment?.status === "REJECTED" && (
              <p className="m-0 flex items-start gap-1.5 border-l-4 border-[#b91c1c] bg-[#fdecec] px-3 py-2 text-[14px] text-[#991b1b]">
                <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden /> {t("rejected", { note: v.payment.note ?? "" })}
              </p>
            )}
            <p className="m-0 text-[15px] font-semibold">{t("payIntro", { total: xof(v.totalXof), ref: v.reference })}</p>
            {v.links.length === 0 ? (
              <p className="m-0 text-[14px] text-pn-gray-1">{t("noLinks")}</p>
            ) : (
              v.links.map((l) => (
                <a
                  key={l.code}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMethod(l.method === "ORANGE_MONEY" ? "ORANGE_MONEY" : l.method === "WAVE" ? "WAVE" : "OTHER")}
                  className={`flex min-h-14 items-center justify-center gap-2 text-[17px] font-extrabold text-white no-underline ${l.method === "ORANGE_MONEY" ? "bg-[#ff7900]" : l.method === "WAVE" ? "bg-[#1dc8f2] text-[#0b2e3a]" : "bg-pn-accent"}`}
                >
                  {l.label} <ExternalLink size={16} aria-hidden />
                </a>
              ))
            )}
            <form onSubmit={submitTo(paidAction)} className="flex flex-col gap-2 border-t border-pn-rule pt-3">
              <input type="hidden" name="caseId" value={v.caseId} />
              <p className="m-0 text-[15px] font-semibold">{t("afterPaying")}</p>
              <div role="radiogroup" aria-label={t("paidWith")} className="grid grid-cols-2 gap-2">
                {(["WAVE", "ORANGE_MONEY"] as const).map((m) => (
                  <label key={m} className={`flex h-12 cursor-pointer items-center justify-center border-2 text-[15px] font-semibold ${method === m ? "border-pn-ink bg-pn-accent-soft" : "border-pn-border-muted bg-white"}`}>
                    <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                    {m === "WAVE" ? "Wave" : "Orange Money"}
                  </label>
                ))}
              </div>
              <input name="reference" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} placeholder={t("transactionId")} aria-label={t("transactionId")} className="h-12 border-2 border-pn-border-muted bg-white px-3 text-[16px]" />
              <button type="submit" disabled={reporting} className="h-14 cursor-pointer bg-pn-ink text-[17px] font-extrabold text-white disabled:opacity-50">
                {t("iHavePaid")}
              </button>
              {error(paid)}
            </form>
          </>
        )}
      </div>
    );
  }

  // Paid and beyond: the total, confirmed.
  return (
    <div className="flex flex-col gap-2">
      {breakdown}
      {["PAID", "PREPARING", "COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(v.status) && (
        <p className="m-0 flex items-center gap-1.5 font-semibold text-[#0a5c3c]">
          <CheckCircle2 size={18} aria-hidden /> {t("paidConfirmed", { total: xof(v.totalXof) })}
        </p>
      )}
    </div>
  );
}
