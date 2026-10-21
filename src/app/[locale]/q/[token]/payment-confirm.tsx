"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { confirmPharmacyPaymentAction } from "../actions";

/** The chosen pharmacy confirms it received Nomad's payment — the order is
 * then ready and Nomad books the courier. */
export function PaymentConfirm({ token }: { token: string }) {
  const t = useTranslations("Quote");
  const [state, action, pending] = useActionState<{ ok: boolean; error?: string } | null, FormData>(confirmPharmacyPaymentAction, null);
  if (state?.ok) {
    return (
      <p role="status" className="m-0 flex items-center gap-2 border-2 border-pn-accent bg-pn-accent-soft p-4 text-[16px] font-bold text-[#08432c]">
        <CheckCircle2 size={20} aria-hidden /> {t("paymentConfirmedThanks")}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="h-14 cursor-pointer bg-pn-accent text-[17px] font-extrabold text-white disabled:opacity-50">
        {pending ? t("sending") : t("confirmPaymentReceived")}
      </button>
      {state && !state.ok && <p className="m-0 font-semibold text-[#b91c1c]">{t.has(`error.${state.error}`) ? t(`error.${state.error}`) : t("error.invalid")}</p>}
    </form>
  );
}
