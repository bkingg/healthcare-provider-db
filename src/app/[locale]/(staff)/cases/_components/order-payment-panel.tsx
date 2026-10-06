"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import {
  confirmPaymentAction,
  payPharmacyAction,
  recordApprovalAction,
  rejectPaymentAction,
  resendPriceAction,
  revisePriceAction,
  setPaymentLinkAction,
  type StaffOrderState,
} from "../actions";

export type StaffPaymentView = {
  orderId: string;
  status: string;
  price: { medicinesXof: number; deliveryXof: number; feeXof: number; totalXof: number; note: string | null; sentAt: string; validUntil: string | null; expired: boolean } | null;
  approvedAt: string | null;
  approvedByPhone: boolean;
  declined: { at: string; reason: string | null } | null;
  paymentLinkUrl: string | null;
  standardLinks: number;
  payments: { id: string; direction: string; method: string; amountXof: number; status: string; reference: string | null; at: string; byMember: boolean; who: string | null; note: string | null }[];
  payout: { options: { id: string; label: string }[]; pharmacy: string | null } | null;
};

/** Submits without React's automatic form reset, so a rejected entry keeps
 * what staff typed. */
const submitTo = (dispatch: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => dispatch(fd));
};
const xof = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const input = "h-8 border-2 border-pn-border-muted bg-white px-2 text-[12.5px] outline-none focus:border-pn-ink";

/** The order's money: the member's price (revise, re-send, record a phone
 * approval), the member's payment (confirm what they reported, or record
 * one), and paying the pharmacy from its approved details. */
export function OrderPaymentPanel({ v }: { v: StaffPaymentView }) {
  const t = useTranslations("OrderPay");
  const [revising, setRevising] = useState(false);
  const [revise, reviseAction] = useActionState<StaffOrderState, FormData>(revisePriceAction, null);
  const [confirm, confirmAction] = useActionState<StaffOrderState, FormData>(confirmPaymentAction, null);
  const [payout, payoutAction] = useActionState<StaffOrderState, FormData>(payPharmacyAction, null);
  const [link, linkAction] = useActionState<StaffOrderState, FormData>(setPaymentLinkAction, null);
  const err = (s: StaffOrderState) => (s && !s.ok ? <p className="m-0 text-[12px] font-semibold text-[#b91c1c]">{t.has(`error.${s.error}`) ? t(`error.${s.error}`) : t("error.other")}</p> : null);
  const reported = v.payments.find((p) => p.direction === "FROM_MEMBER" && p.status === "REPORTED");
  const [method, setMethod] = useState(reported?.method ?? "WAVE");

  if (!v.price) return <p className="m-0 text-[12.5px] text-pn-gray-2">{t("noPriceYet")}</p>;
  const p = v.price;
  return (
    <div className="flex flex-col gap-3 text-[12.5px]">
      <div className="flex flex-col gap-1 border border-pn-rule bg-white p-2.5">
        <div className="grid grid-cols-[1fr_auto] gap-x-4 tabular-nums">
          <span>{t("medicines")}</span>
          <span className="text-right">{xof(p.medicinesXof)}</span>
          <span>{t("delivery")}</span>
          <span className="text-right">{xof(p.deliveryXof)}</span>
          <span>{t("fee")}</span>
          <span className="text-right">{xof(p.feeXof)}</span>
          <span className="font-bold">{t("total")}</span>
          <span className="text-right text-[14px] font-bold">{xof(p.totalXof)}</span>
        </div>
        <span className="text-[11.5px] text-pn-gray-2">
          {t("sentAt", { when: p.sentAt })}
          {p.validUntil && ` · ${p.expired && v.status === "AWAITING_APPROVAL" ? t("expiredAt", { when: p.validUntil }) : t("validUntil", { when: p.validUntil })}`}
        </span>
        {p.note && <span className="text-[11.5px] text-[#b45309]">{t("revisedBecause", { note: p.note })}</span>}
        {v.approvedAt && (
          <span className="flex items-center gap-1 font-semibold text-[#0a5c3c]">
            <CheckCircle2 size={13} aria-hidden /> {v.approvedByPhone ? t("approvedByPhone", { when: v.approvedAt }) : t("approvedInApp", { when: v.approvedAt })}
          </span>
        )}
        {v.declined && <span className="font-semibold text-[#b91c1c]">{t("declined", { when: v.declined.at, reason: v.declined.reason ?? "—" })}</span>}
      </div>

      {v.status === "AWAITING_APPROVAL" && (
        <div className="flex flex-wrap items-center gap-2">
          {p.expired && (
            <form action={resendPriceAction}>
              <input type="hidden" name="orderId" value={v.orderId} />
              <button type="submit" className="h-7 cursor-pointer border-2 border-pn-ink bg-white px-2 text-[12px] font-semibold">
                {t("resend")}
              </button>
            </form>
          )}
          {!p.expired && (
            <form action={recordApprovalAction}>
              <input type="hidden" name="orderId" value={v.orderId} />
              <button type="submit" className="h-7 cursor-pointer border border-pn-ink bg-white px-2 text-[12px] font-semibold">
                {t("recordApproval")}
              </button>
            </form>
          )}
          <button type="button" onClick={() => setRevising((x) => !x)} className="cursor-pointer text-[12px] font-semibold text-pn-gray-1 hover:underline">
            {t("revise")}
          </button>
        </div>
      )}
      {revising && v.status === "AWAITING_APPROVAL" && (
        <form onSubmit={submitTo(reviseAction)} className="flex flex-wrap items-end gap-2 border-l-4 border-pn-ink pl-2">
          <input type="hidden" name="orderId" value={v.orderId} />
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
            {t("delivery")}
            <input name="deliveryXof" defaultValue={p.deliveryXof} inputMode="numeric" className={`${input} w-24`} />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
            {t("fee")}
            <input name="feeXof" defaultValue={p.feeXof} inputMode="numeric" className={`${input} w-24`} />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
            {t("reason")}
            <input name="note" required className={input} />
          </label>
          <button type="submit" className="h-8 cursor-pointer bg-pn-ink px-3 text-[12px] font-semibold text-white">
            {t("resendRevised")}
          </button>
          {err(revise)}
        </form>
      )}

      {v.status === "AWAITING_PAYMENT" && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("memberPayment")}</span>
          {reported && (
            <p className="m-0 border-l-4 border-[#1d4ed8] bg-[#eef4ff] px-2 py-1">
              {t("memberSaysPaid", { method: t(`method.${reported.method}`), amount: xof(reported.amountXof), ref: reported.reference ?? "—", when: reported.at })}
            </p>
          )}
          <form onSubmit={submitTo(confirmAction)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderId" value={v.orderId} />
            <input type="hidden" name="paymentId" value={reported?.id ?? ""} />
            <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
              {t("methodLabel")}
              <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                {["WAVE", "ORANGE_MONEY", "CASH", "OTHER"].map((m) => (
                  <option key={m} value={m}>
                    {t(`method.${m}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
              {t("amount")}
              <input name="amountXof" defaultValue={reported?.amountXof ?? p.totalXof} inputMode="numeric" className={`${input} w-28`} />
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
              {t("transactionId")}
              <input name="reference" defaultValue={reported?.reference ?? ""} className={input} />
            </label>
            <button type="submit" className="h-8 cursor-pointer bg-pn-accent px-3 text-[12px] font-semibold text-white">
              {reported ? t("confirmReceived") : t("recordPayment")}
            </button>
          </form>
          {err(confirm)}
          {reported && (
            <form action={rejectPaymentAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="orderId" value={v.orderId} />
              <input type="hidden" name="paymentId" value={reported.id} />
              <input name="note" placeholder={t("rejectNote")} aria-label={t("rejectNote")} className={`${input} min-w-[200px] flex-1`} />
              <button type="submit" className="h-8 cursor-pointer border-2 border-[#b91c1c] bg-white px-2 text-[12px] font-semibold text-[#991b1b]">
                {t("notFound")}
              </button>
            </form>
          )}
          <form onSubmit={submitTo(linkAction)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderId" value={v.orderId} />
            <label className="flex min-w-[220px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
              {t("exactLink")}
              <input name="url" type="url" defaultValue={v.paymentLinkUrl ?? ""} placeholder="https://pay.wave.com/…" className={input} />
            </label>
            <button type="submit" className="h-8 cursor-pointer border border-pn-ink bg-white px-2 text-[12px] font-semibold">
              {t("saveLink")}
            </button>
          </form>
          {err(link)}
          {!v.paymentLinkUrl && v.standardLinks === 0 && <p className="m-0 text-[11.5px] font-semibold text-[#b45309]">{t("noLinksWarning")}</p>}
        </div>
      )}

      {v.status === "PAID" && v.payout && (
        <form onSubmit={submitTo(payoutAction)} className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("payPharmacy", { pharmacy: v.payout.pharmacy ?? "" })}</span>
          <input type="hidden" name="orderId" value={v.orderId} />
          {v.payout.options.length === 0 ? (
            <p className="m-0 font-semibold text-[#b91c1c]">{t("noApprovedDetails")}</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {v.payout.options.map((o, i) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="bankingPaymentId" value={o.id} defaultChecked={i === 0} className="accent-pn-ink" /> {o.label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
                  {t("amount")}
                  <input name="amountXof" defaultValue={p.medicinesXof} inputMode="numeric" className={`${input} w-28`} />
                </label>
                <label className="flex min-w-[160px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
                  {t("transactionId")}
                  <input name="reference" required className={input} />
                </label>
                <button type="submit" className="h-8 cursor-pointer bg-pn-accent px-3 text-[12px] font-semibold text-white">
                  {t("recordPayout")}
                </button>
              </div>
            </>
          )}
          {err(payout)}
        </form>
      )}

      {v.payments.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("history")}</span>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px]">
            {v.payments.map((x) => (
              <li key={x.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t(`direction.${x.direction}`)} · {t(`method.${x.method}`)} · <span className="tabular-nums">{xof(x.amountXof)}</span> · {x.reference ?? "—"}
                </span>
                <span className={x.status === "CONFIRMED" ? "font-semibold text-[#0a5c3c]" : x.status === "REJECTED" ? "font-semibold text-[#b91c1c]" : "font-semibold text-[#1d4ed8]"}>
                  {t(`paymentStatus.${x.status}`)} · {x.at}
                  {x.who ? ` · ${x.who}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
