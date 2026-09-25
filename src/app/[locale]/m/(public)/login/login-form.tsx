"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { requestLoginLinkAction, type LoginLinkState } from "../../actions";

export function LoginForm() {
  const t = useTranslations("MemberApp");
  const [state, action, pending] = useActionState<LoginLinkState, FormData>(requestLoginLinkAction, null);

  if (state?.sent) {
    return (
      <div role="status" className="flex flex-col gap-3 border-2 border-pn-ink bg-white p-4">
        <div className="flex items-center gap-2 text-[17px] font-bold">
          <MailCheck size={20} className="text-pn-accent" aria-hidden /> {t("checkEmailTitle")}
        </div>
        <p className="m-0 text-[15px] text-pn-gray-1">{t("checkEmailBody")}</p>
        {state.devLink && (
          <div className="flex flex-col gap-1 border-l-4 border-[#b45309] bg-[#fcefd9] p-3 text-[13px]">
            <strong>{t("devLinkTitle")}</strong>
            <span>{t("devLinkBody")}</span>
            <a href={state.devLink} className="font-semibold break-all text-[#0a5c3c] underline">
              {t("devLinkOpen")}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-[14px] font-semibold">
        {t("emailLabel")}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        className="h-12 border-2 border-pn-border-muted bg-white px-3 text-[16px] outline-none focus:border-pn-ink"
      />
      {state && !state.sent && (
        <p role="alert" className="m-0 text-[14px] font-semibold text-[#b91c1c]">
          {t(state.error)}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-12 cursor-pointer bg-pn-accent text-[16px] font-bold text-white active:bg-pn-accent-hover disabled:opacity-50">
        {pending ? t("sending") : t("sendLink")}
      </button>
    </form>
  );
}
