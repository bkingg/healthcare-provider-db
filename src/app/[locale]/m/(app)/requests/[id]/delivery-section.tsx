"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, CheckCircle2, Circle, ExternalLink, FileText, Phone } from "lucide-react";
import { confirmReceivedAction, reportFeePaidAction, type OrderStepState } from "../../../actions";

export type MemberDeliveryView = {
  caseId: string;
  status: string;
  controlled: boolean;
  promisedBy: string | null;
  /** The promised time has passed and it isn't delivered yet. */
  late: boolean;
  steps: { key: string; done: boolean; current: boolean }[];
  active: { trackingUrl: string | null; eta: string | null; courierName: string | null; courierPhone: string | null } | null;
  deliveredAt: string | null;
  fee: { amountXof: number; reported: boolean; links: { code: string; method: string; label: string; url: string }[] } | null;
};

const xof = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Submits without React's form reset (keeps what was typed on an error),
 * including the pressed button. */
const submitTo = (dispatch: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  startTransition(() => dispatch(fd));
};

/** The member's delivery: where it's at, the courier's tracking link, "I've
 * received it", and — if a delivery failed — the re-delivery fee to pay. */
export function DeliverySection({ v }: { v: MemberDeliveryView }) {
  const t = useTranslations("MemberDelivery");
  const [recv, recvAction, recvPending] = useActionState<OrderStepState, FormData>(confirmReceivedAction, null);
  const [fee, feeAction, feePending] = useActionState<OrderStepState, FormData>(reportFeePaidAction, null);
  const [method, setMethod] = useState<"WAVE" | "ORANGE_MONEY">(v.fee?.links[0]?.method === "ORANGE_MONEY" ? "ORANGE_MONEY" : "WAVE");
  const [ref, setRef] = useState("");
  const error = (s: OrderStepState) => (s && !s.ok ? <p className="m-0 text-[14px] font-semibold text-[#b91c1c]">{t.has(`error.${s.error}`) ? t(`error.${s.error}`) : t("error.other")}</p> : null);
  const onTheWay = ["COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP"].includes(v.status);

  return (
    <div className="flex flex-col gap-3">
      {v.promisedBy && v.status !== "DELIVERED" && (
        <p className={`m-0 text-[15px] font-semibold ${v.late ? "border-l-4 border-[#b45309] bg-[#fff7ed] px-3 py-2" : ""}`}>{v.late ? t("late") : t("promisedBy", { when: v.promisedBy })}</p>
      )}

      <ol className="m-0 flex list-none flex-col gap-1.5 border border-pn-rule bg-white p-3">
        {v.steps.map((s) => (
          <li key={s.key} className={`flex items-center gap-2 text-[15px] ${s.current ? "font-bold" : s.done ? "text-pn-gray-1" : "text-pn-gray-3"}`}>
            {s.done ? <Check size={16} className="flex-none text-[#0a5c3c]" aria-hidden /> : <Circle size={14} className={`flex-none ${s.current ? "fill-pn-accent text-pn-accent" : ""}`} aria-hidden />}
            {t(`step.${s.key}`)}
          </li>
        ))}
      </ol>

      {v.controlled && v.status === "COURIER_REQUESTED" && (
        <p className="m-0 flex items-start gap-1.5 border-l-4 border-[#b45309] bg-[#fff7ed] px-3 py-2 text-[14px]">
          <FileText size={16} className="mt-0.5 flex-none" aria-hidden /> {t("haveOriginalReady")}
        </p>
      )}

      {onTheWay && v.active && (
        <div className="flex flex-col gap-2">
          {v.active.trackingUrl && (
            <a href={v.active.trackingUrl} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-center gap-2 bg-pn-accent text-[17px] font-extrabold text-white no-underline">
              {t("follow")} <ExternalLink size={16} aria-hidden />
            </a>
          )}
          {v.active.eta && <p className="m-0 text-[14px] text-pn-gray-1">{t("eta", { when: v.active.eta })}</p>}
          {v.active.courierPhone && (
            <a href={`tel:${v.active.courierPhone.replace(/[^+\d]/g, "")}`} className="flex min-h-12 items-center justify-center gap-2 border-2 border-pn-ink bg-white text-[15px] font-semibold text-pn-ink no-underline">
              <Phone size={16} aria-hidden /> {t("callCourier", { name: v.active.courierName ?? t("courier") })}
            </a>
          )}
          {recv?.ok ? (
            <p className="m-0 font-semibold text-[#0a5c3c]">{t("thanks")}</p>
          ) : (
            <form onSubmit={submitTo(recvAction)} className="flex flex-col gap-2 border-t border-pn-rule pt-3">
              <input type="hidden" name="caseId" value={v.caseId} />
              <button type="submit" disabled={recvPending} className="h-14 cursor-pointer bg-pn-ink text-[17px] font-extrabold text-white disabled:opacity-50">
                {t("received")}
              </button>
              {error(recv)}
            </form>
          )}
        </div>
      )}

      {v.status === "DELIVERY_FAILED" && v.fee && (
        <div className="flex flex-col gap-3">
          <p className="m-0 flex items-start gap-1.5 border-l-4 border-[#b91c1c] bg-[#fdecec] px-3 py-2 text-[15px] text-[#991b1b]">
            <AlertTriangle size={18} className="mt-0.5 flex-none" aria-hidden /> {t("failed", { fee: xof(v.fee.amountXof) })}
          </p>
          {v.fee.reported || fee?.ok ? (
            <p role="status" className="m-0 flex items-start gap-1.5 border-l-4 border-pn-accent bg-pn-accent-soft px-3 py-2 text-[15px]">
              <CheckCircle2 size={18} className="mt-0.5 flex-none text-[#0a5c3c]" aria-hidden /> {t("checkingFee")}
            </p>
          ) : (
            <>
              {v.fee.links.length === 0 ? (
                <p className="m-0 text-[14px] text-pn-gray-1">{t("noLinks")}</p>
              ) : (
                v.fee.links.map((l) => (
                  <a
                    key={l.code}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMethod(l.method === "ORANGE_MONEY" ? "ORANGE_MONEY" : "WAVE")}
                    className={`flex min-h-14 items-center justify-center gap-2 text-[17px] font-extrabold no-underline ${l.method === "ORANGE_MONEY" ? "bg-[#ff7900] text-white" : l.method === "WAVE" ? "bg-[#1dc8f2] text-[#0b2e3a]" : "bg-pn-accent text-white"}`}
                  >
                    {l.label} <ExternalLink size={16} aria-hidden />
                  </a>
                ))
              )}
              <form onSubmit={submitTo(feeAction)} className="flex flex-col gap-2 border-t border-pn-rule pt-3">
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
                <button type="submit" disabled={feePending} className="h-14 cursor-pointer bg-pn-ink text-[17px] font-extrabold text-white disabled:opacity-50">
                  {t("iHavePaid")}
                </button>
                {error(fee)}
              </form>
            </>
          )}
        </div>
      )}

      {v.status === "DELIVERED" && (
        <p className="m-0 flex items-center gap-1.5 text-[15px] font-semibold text-[#0a5c3c]">
          <CheckCircle2 size={18} aria-hidden /> {t("delivered", { when: v.deliveredAt ?? "" })}
        </p>
      )}
    </div>
  );
}
