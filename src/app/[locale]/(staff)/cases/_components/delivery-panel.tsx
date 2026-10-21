"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ExternalLink, Phone, Snowflake, TriangleAlert, Truck } from "lucide-react";
import {
  bookCourierAction,
  confirmFeePaidAction,
  markDeliveredAction,
  markFailedAction,
  markOriginalCollectedAction,
  markPickedUpAction,
  markReadyAction,
  waiveFeeAction,
  type StaffOrderState,
} from "../actions";

type Stop = { kind: "PHARMACY" | "MEMBER" | "MEMBER_ORIGINAL"; name: string; address: string; phone: string | null; mapUrl: string | null };
export type StaffDeliveryView = {
  orderId: string;
  status: string;
  controlled: boolean;
  coldChain: boolean;
  pharmacyName: string | null;
  pharmacyPaidAt: string | null;
  readyAt: string | null;
  promisedBy: string | null;
  late: boolean;
  stops: Stop[];
  active: {
    trackingUrl: string | null;
    bookingRef: string | null;
    costXof: number | null;
    etaAt: string | null;
    etaInput: string;
    courierName: string | null;
    courierPhone: string | null;
    bookedAt: string;
    bookedBy: string | null;
  } | null;
  history: { attempt: number; when: string; outcome: string; note: string | null; costXof: number | null; trackingUrl: string | null }[];
  dueCharge: { amountXof: number; reason: string | null; reportedMethod: string | null; reportedRef: string | null; reportedAt: string | null } | null;
  defaultFeeXof: number;
};

const xof = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const input = "h-8 border-2 border-pn-border-muted bg-white px-2 text-[12.5px] outline-none focus:border-pn-ink";
const btn = "h-8 cursor-pointer px-3 text-[12px] font-semibold disabled:opacity-50";

/** Submits without React's form reset, so a rejected entry keeps what was typed. */
const submitTo = (dispatch: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => dispatch(fd));
};

/** Delivery, after Nomad pays the pharmacy: wait for the pharmacy to
 * confirm the payment, book the courier in Yango and record it, follow the
 * steps (3 stops for a controlled medicine), and handle a failed delivery
 * (re-delivery fee, which staff can cancel). */
export function DeliveryPanel({ v }: { v: StaffDeliveryView }) {
  const t = useTranslations("Delivery");
  const [ready, readyAction, readyPending] = useActionState<StaffOrderState, FormData>(markReadyAction, null);
  const [book, bookAction, bookPending] = useActionState<StaffOrderState, FormData>(bookCourierAction, null);
  const [orig, origAction, origPending] = useActionState<StaffOrderState, FormData>(markOriginalCollectedAction, null);
  const [picked, pickedAction, pickedPending] = useActionState<StaffOrderState, FormData>(markPickedUpAction, null);
  const [deliv, delivAction, delivPending] = useActionState<StaffOrderState, FormData>(markDeliveredAction, null);
  const [failed, failedAction, failedPending] = useActionState<StaffOrderState, FormData>(markFailedAction, null);
  const [waive, waiveAction, waivePending] = useActionState<StaffOrderState, FormData>(waiveFeeAction, null);
  const [feePaid, feePaidAction, feePaidPending] = useActionState<StaffOrderState, FormData>(confirmFeePaidAction, null);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState<"delivered" | "failed" | null>(null);
  const [feeMethod, setFeeMethod] = useState(v.dueCharge?.reportedMethod ?? "WAVE");

  const err = (s: StaffOrderState) => (s && !s.ok ? <p className="m-0 text-[12px] font-semibold text-[#b91c1c]">{t.has(`error.${s.error}`) ? t(`error.${s.error}`) : t("error.other")}</p> : null);
  const hidden = <input type="hidden" name="orderId" value={v.orderId} />;
  const onTheWay = ["COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP"].includes(v.status);
  const a = v.active;

  const bookingForm = (
    <form onSubmit={submitTo(bookAction)} className="flex flex-col gap-2 border-l-4 border-pn-ink bg-white p-2.5">
      {hidden}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold sm:col-span-2">
          {t("trackingUrl")}
          <input name="trackingUrl" type="url" defaultValue={a?.trackingUrl ?? ""} placeholder="https://…" className={input} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
          {t("bookingRef")}
          <input name="bookingRef" defaultValue={a?.bookingRef ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
          {t("cost")}
          <input name="costXof" inputMode="numeric" defaultValue={a?.costXof ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
          {t("eta")}
          <input name="etaAt" type="datetime-local" defaultValue={a?.etaInput ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
          {t("courierName")}
          <input name="courierName" defaultValue={a?.courierName ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
          {t("courierPhone")}
          <input name="courierPhone" type="tel" defaultValue={a?.courierPhone ?? ""} className={input} />
        </label>
      </div>
      <p className="m-0 text-[11.5px] text-pn-gray-2">{t("bookingHelp")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={bookPending} className={`${btn} bg-pn-accent text-white`}>
          {a ? t("saveBooking") : t("recordBooking")}
        </button>
        {a && (
          <button type="button" onClick={() => setEditing(false)} className={`${btn} text-pn-gray-1`}>
            {t("cancel")}
          </button>
        )}
      </div>
      {err(book)}
    </form>
  );

  return (
    <div className="flex flex-col gap-3 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-pn-ink px-2 py-0.5 text-[11px] font-bold text-white uppercase">{t(`status.${v.status}`)}</span>
        {v.controlled && <span className="bg-[#c62828] px-1.5 text-[11px] font-bold text-white">{t("controlled")}</span>}
        {v.coldChain && (
          <span className="flex items-center gap-0.5 bg-[#e0f2fe] px-1.5 text-[11px] font-bold text-[#075985]">
            <Snowflake size={10} aria-hidden /> {t("coldChain")}
          </span>
        )}
        {v.promisedBy && <span className={`text-[12px] ${v.late ? "font-bold text-[#c62828]" : "text-pn-gray-1"}`}>{t(v.late ? "lateSince" : "promisedBy", { when: v.promisedBy })}</span>}
      </div>
      {v.coldChain && <p className="m-0 text-[12px] text-[#075985]">{t("coldChainHelp")}</p>}

      {v.status === "PREPARING" && (
        <div className="flex flex-col gap-2 border-l-4 border-[#b45309] bg-[#fff7ed] px-2.5 py-2">
          <p className="m-0">{t("waitingPharmacy", { pharmacy: v.pharmacyName ?? "—", when: v.pharmacyPaidAt ?? "—" })}</p>
          <form onSubmit={submitTo(readyAction)}>
            {hidden}
            <button type="submit" disabled={readyPending} className={`${btn} border border-pn-ink bg-white`}>
              {t("pharmacyConfirmedByPhone")}
            </button>
          </form>
          {err(ready)}
        </div>
      )}

      {(v.status === "READY_FOR_PICKUP" || onTheWay) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{v.controlled ? t("stopsControlled") : t("stops")}</span>
          <ol className="m-0 flex flex-col gap-1 pl-5">
            {v.stops.map((s, i) => (
              <li key={i}>
                <span className="font-semibold">{s.name}</span>
                {s.kind === "MEMBER_ORIGINAL" && <span className="font-semibold text-[#b45309]"> ({t("collectOriginalStop")})</span>} — {s.address}
                {s.phone && (
                  <a href={`tel:${s.phone.replace(/[^+\d]/g, "")}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-[#0a5c3c]">
                    <Phone size={11} aria-hidden /> {s.phone}
                  </a>
                )}
                {s.mapUrl && (
                  <a href={s.mapUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-[#0a5c3c]">
                    <ExternalLink size={11} aria-hidden /> {t("map")}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {v.status === "READY_FOR_PICKUP" && (
        <>
          <p className="m-0 flex items-center gap-1.5 font-semibold text-[#0a5c3c]">
            <Truck size={15} aria-hidden /> {t("readyBook", { when: v.readyAt ?? "—" })}
          </p>
          {bookingForm}
        </>
      )}

      {onTheWay && a && (
        <div className="flex flex-col gap-2 border border-pn-rule bg-white p-2.5">
          {editing ? (
            bookingForm
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {a.trackingUrl && (
                  <a href={a.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0a5c3c]">
                    <ExternalLink size={12} aria-hidden /> {t("tracking")}
                  </a>
                )}
                {a.bookingRef && <span>{t("refShort", { ref: a.bookingRef })}</span>}
                {a.etaAt && <span>{t("etaShort", { when: a.etaAt })}</span>}
                {a.costXof !== null && <span className="tabular-nums">{xof(a.costXof)}</span>}
                {a.courierName && (
                  <span>
                    {a.courierName}
                    {a.courierPhone ? ` · ${a.courierPhone}` : ""}
                  </span>
                )}
              </div>
              <span className="text-[11.5px] text-pn-gray-2">{t("bookedBy", { when: a.bookedAt, who: a.bookedBy ?? "—" })}</span>
              <div className="flex flex-wrap items-center gap-2">
                {v.status === "COURIER_REQUESTED" && v.controlled && (
                  <form onSubmit={submitTo(origAction)}>
                    {hidden}
                    <button type="submit" disabled={origPending} className={`${btn} bg-pn-ink text-white`}>
                      {t("originalCollected")}
                    </button>
                  </form>
                )}
                {(v.status === "ORIGINAL_COLLECTED" || (v.status === "COURIER_REQUESTED" && !v.controlled)) && (
                  <form onSubmit={submitTo(pickedAction)}>
                    {hidden}
                    <button type="submit" disabled={pickedPending} className={`${btn} bg-pn-ink text-white`}>
                      {t("pickedUp")}
                    </button>
                  </form>
                )}
                <button type="button" onClick={() => setClosing(closing === "delivered" ? null : "delivered")} className={`${btn} border border-pn-ink bg-white`}>
                  {t("markDelivered")}
                </button>
                <button type="button" onClick={() => setClosing(closing === "failed" ? null : "failed")} className={`${btn} border border-[#b91c1c] bg-white text-[#991b1b]`}>
                  {t("markFailed")}
                </button>
                <button type="button" onClick={() => setEditing(true)} className={`${btn} text-pn-gray-1`}>
                  {t("editBooking")}
                </button>
              </div>
              {err(orig)}
              {err(picked)}
              {closing === "delivered" && (
                <form onSubmit={submitTo(delivAction)} className="flex flex-wrap items-end gap-2">
                  {hidden}
                  <label className="flex min-w-[220px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
                    {t("deliveredNote")}
                    <input name="note" required className={input} />
                  </label>
                  <button type="submit" disabled={delivPending} className={`${btn} bg-pn-accent text-white`}>
                    {t("confirmDelivered")}
                  </button>
                  {err(deliv)}
                </form>
              )}
              {closing === "failed" && (
                <form onSubmit={submitTo(failedAction)} className="flex flex-wrap items-end gap-2">
                  {hidden}
                  <label className="flex min-w-[220px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
                    {t("failReason")}
                    <input name="reason" required placeholder={t("failReasonPlaceholder")} className={input} />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
                    {t("redeliveryFee")}
                    <input name="feeXof" inputMode="numeric" defaultValue={v.defaultFeeXof} className={`${input} w-28`} />
                  </label>
                  <button type="submit" disabled={failedPending} className={`${btn} bg-[#b91c1c] text-white`}>
                    {t("confirmFailed")}
                  </button>
                  <p className="m-0 w-full text-[11.5px] text-pn-gray-2">{t("feeHelp")}</p>
                  {err(failed)}
                </form>
              )}
            </>
          )}
        </div>
      )}

      {v.status === "DELIVERY_FAILED" && v.dueCharge && (
        <div className="flex flex-col gap-2 border-l-4 border-[#b91c1c] bg-[#fdecec] px-2.5 py-2">
          <p className="m-0 flex items-start gap-1.5 font-semibold text-[#991b1b]">
            <TriangleAlert size={15} className="mt-0.5 flex-none" aria-hidden /> {t("feeDue", { fee: xof(v.dueCharge.amountXof), reason: v.dueCharge.reason ?? "—" })}
          </p>
          {v.dueCharge.reportedAt && (
            <p className="m-0 border-l-4 border-[#1d4ed8] bg-white px-2 py-1">{t("memberSaysFeePaid", { method: t(`method.${v.dueCharge.reportedMethod ?? "OTHER"}`), ref: v.dueCharge.reportedRef ?? "—", when: v.dueCharge.reportedAt })}</p>
          )}
          <form onSubmit={submitTo(feePaidAction)} className="flex flex-wrap items-end gap-2">
            {hidden}
            <label className="flex flex-col gap-0.5 text-[11px] font-semibold">
              {t("methodLabel")}
              <select name="method" value={feeMethod} onChange={(e) => setFeeMethod(e.target.value)} className={input}>
                {["WAVE", "ORANGE_MONEY", "CASH", "OTHER"].map((m) => (
                  <option key={m} value={m}>
                    {t(`method.${m}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
              {t("transactionId")}
              <input name="reference" defaultValue={v.dueCharge.reportedRef ?? ""} className={input} />
            </label>
            <button type="submit" disabled={feePaidPending} className={`${btn} bg-pn-accent text-white`}>
              {t("feeReceived")}
            </button>
          </form>
          {err(feePaid)}
          <form onSubmit={submitTo(waiveAction)} className="flex flex-wrap items-end gap-2">
            {hidden}
            <label className="flex min-w-[220px] flex-1 flex-col gap-0.5 text-[11px] font-semibold">
              {t("waiveReason")}
              <input name="reason" required className={input} />
            </label>
            <button type="submit" disabled={waivePending} className={`${btn} border-2 border-pn-ink bg-white`}>
              {t("waiveFee")}
            </button>
          </form>
          {err(waive)}
        </div>
      )}

      {v.status === "DELIVERED" && (
        <p className="m-0 flex items-center gap-1.5 font-semibold text-[#0a5c3c]">
          <CheckCircle2 size={15} aria-hidden /> {t("deliveredDone")}
        </p>
      )}

      {v.history.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("history")}</span>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px]">
            {v.history.map((h) => (
              <li key={h.attempt} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t("attempt", { n: h.attempt })} · {t(`outcome.${h.outcome}`)}
                  {h.note ? ` — ${h.note}` : ""}
                </span>
                <span className="text-pn-gray-2 tabular-nums">
                  {h.costXof !== null ? `${xof(h.costXof)} · ` : ""}
                  {h.when}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
