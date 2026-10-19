"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle, UserRound } from "lucide-react";
import { localizedText } from "@/lib/localizedText";
import { phoneSignInAction, type PhoneSignInState } from "../../actions";

const input = "h-12 w-full border-2 border-pn-border-muted bg-white px-3 text-[16px] outline-none focus:border-pn-ink";
const primary = "h-12 w-full cursor-pointer bg-pn-accent text-[16px] font-bold text-white active:bg-pn-accent-hover disabled:opacity-50";

/** Sign in with a code sent on WhatsApp: phone → code → (which profile, if
 * the household shares the number | quick start, for a number Nomad
 * doesn't know). Submits without React's form reset, so typed values stay
 * when a step comes back with an error. */
export function PhoneSignIn({ countries, requestHelp }: { countries: { iso2: string; callingCode: string; name: string }[]; requestHelp: boolean }) {
  const t = useTranslations("MemberSignIn");
  const locale = useLocale();
  const [state, dispatch, pending] = useActionState<PhoneSignInState, FormData>(phoneSignInAction, null);
  const [country, setCountry] = useState(countries[0]?.iso2 ?? "SN");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const [consent, setConsent] = useState(false);
  const calling = countries.find((c) => c.iso2 === country)?.callingCode ?? "+221";

  const submit = (step: string, extra: Record<string, string> = {}) => (e?: FormEvent) => {
    e?.preventDefault();
    const fd = new FormData();
    fd.set("step", step);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    startTransition(() => dispatch(fd));
  };
  const error = (s: PhoneSignInState) =>
    s && "error" in s && s.error ? (
      <p role="alert" className="m-0 text-[14px] font-semibold text-[#b91c1c]">
        {t.has(`error.${s.error}`) ? t(`error.${s.error}`) : t("error.other")}
      </p>
    ) : null;

  if (state?.stage === "code") {
    return (
      <form onSubmit={submit("verify", { phone: state.phone, code })} className="flex flex-col gap-3">
        <p className="m-0 flex items-start gap-2 text-[15px]">
          <MessageCircle size={20} className="mt-0.5 flex-none text-[#128c4a]" aria-hidden />
          <span>{t("codeSent", { phone: state.masked })}</span>
        </p>
        {state.devCode && (
          <p className="m-0 border-l-4 border-[#b45309] bg-[#fcefd9] p-3 text-[13px]">
            <strong>{t("devCodeTitle")}</strong> {t("devCodeBody")} <span className="font-mono text-[16px] font-bold tracking-[0.2em]">{state.devCode}</span>
          </p>
        )}
        <label htmlFor="code" className="text-[14px] font-semibold">
          {t("codeLabel")}
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          className={`${input} text-center font-mono text-[22px] tracking-[0.4em]`}
        />
        {error(state)}
        <button type="submit" disabled={pending || code.length !== 6} className={primary}>
          {pending ? t("checking") : t("confirm")}
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-[14px]">
          <button type="button" onClick={submit("send", { phone, country })} disabled={pending} className="cursor-pointer font-semibold text-[#0a5c3c] underline disabled:opacity-50">
            {t("resend")}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="cursor-pointer font-semibold text-pn-gray-1 underline">
            {t("changeNumber")}
          </button>
        </div>
      </form>
    );
  }

  if (state?.stage === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px] font-semibold">{t("whoIsSigningIn")}</p>
        {state.profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={submit("choose", { memberId: p.id })}
            className="flex min-h-14 cursor-pointer items-center gap-3 border-2 border-pn-ink bg-white px-4 text-left disabled:opacity-50"
          >
            <UserRound size={22} aria-hidden className="flex-none" />
            <span className="flex flex-col">
              <span className="text-[16px] font-bold">
                {p.firstName} {p.lastName}
              </span>
              <span className="text-[13px] text-pn-gray-2">{p.isPrimary ? t("mainMember") : (localizedText(p.relationshipEn ?? "", p.relationshipFr, locale) ?? "")}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (state?.stage === "quickStart") {
    return (
      <form onSubmit={submit("quickStart", { ...names, ...(consent ? { consent: "1" } : {}) })} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 border-l-4 border-pn-accent bg-pn-accent-soft px-3 py-2">
          <p className="m-0 text-[16px] font-bold text-[#08432c]">{t("quickStartTitle")}</p>
          <p className="m-0 text-[14px]">{t("quickStartIntro", { phone: state.masked })}</p>
        </div>
        <label className="flex flex-col gap-1 text-[14px] font-semibold">
          {t("firstName")}
          <input value={names.firstName} onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))} autoComplete="given-name" required maxLength={100} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[14px] font-semibold">
          {t("lastName")}
          <input value={names.lastName} onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))} autoComplete="family-name" required maxLength={100} className={input} />
        </label>
        <p className="m-0 text-[13px] text-pn-gray-1">{t(requestHelp ? "notCoveredNote" : "notCoveredNoteOrdersOnly")}</p>
        <label className="flex cursor-pointer items-start gap-2 text-[14px]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-pn-ink" />
          <span>{t("consent")}</span>
        </label>
        {error(state)}
        <button type="submit" disabled={pending || !consent} className={primary}>
          {pending ? t("creating") : t("createAccount")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit("send", { phone, country })} className="flex flex-col gap-3">
      <label htmlFor="phone" className="text-[14px] font-semibold">
        {t("phoneLabel")}
      </label>
      <div className="flex gap-2">
        {countries.length > 1 ? (
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t("country")} className="h-12 border-2 border-pn-border-muted bg-white px-2 text-[16px]">
            {countries.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.iso2} {c.callingCode}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex h-12 items-center border-2 border-pn-border-muted bg-pn-panel px-3 text-[16px] font-semibold">{calling}</span>
        )}
        <input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" required className={`${input} min-w-0 flex-1`} />
      </div>
      <p className="m-0 text-[13px] text-pn-gray-2">{t("phoneHelp")}</p>
      {error(state)}
      <button type="submit" disabled={pending || !phone.trim()} className={`${primary} flex items-center justify-center gap-2`}>
        <MessageCircle size={18} aria-hidden /> {pending ? t("sending") : t("sendCode")}
      </button>
    </form>
  );
}
