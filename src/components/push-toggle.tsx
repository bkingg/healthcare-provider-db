"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BellRing, Share, X } from "lucide-react";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/pushClient";

const DISMISS_KEY = "nomad.pushPromptDismissed";

const noSubscribe = () => () => {};
function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function usePush(who: "member" | "staff", publicKey: string) {
  const locale = useLocale();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    currentPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    try {
      setState(await enablePush(who, locale, publicKey));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  async function turnOff() {
    setBusy(true);
    await disablePush();
    setState("off");
    setBusy(false);
  }
  return { state, busy, failed, turnOn, turnOff };
}

/** Member home: a one-time invitation to turn phone alerts on (or, on an
 * iPhone in Safari, how to add Nomad to the home screen first). Hidden once
 * on, or once dismissed on this device. */
export function PushPrompt({ publicKey }: { publicKey: string }) {
  const t = useTranslations("Push");
  const { state, busy, failed, turnOn } = usePush("member", publicKey);
  const [closed, setClosed] = useState(false);
  // Remembered on this device; never shown while rendering on the server.
  const dismissedBefore = useSyncExternalStore(noSubscribe, wasDismissed, () => true);
  if (closed || dismissedBefore || !(state === "off" || state === "needsInstall")) return null;
  const dismiss = () => {
    setClosed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private window: it just comes back next time.
    }
  };

  return (
    <div className="relative mx-4 mt-4 flex flex-col gap-2 border-2 border-pn-ink bg-white p-4 pr-11 lg:mx-6">
      <button type="button" onClick={dismiss} aria-label={t("notNow")} title={t("notNow")} className="absolute top-2 right-2 flex h-9 w-9 cursor-pointer items-center justify-center text-pn-gray-2 hover:text-pn-ink">
        <X size={18} aria-hidden />
      </button>
      <div className="flex items-center gap-2 text-[17px] font-bold">
        <BellRing size={20} aria-hidden /> {t("promptTitle")}
      </div>
      {state === "needsInstall" ? (
        <p className="m-0 flex items-start gap-1.5 text-[15px]">
          <Share size={17} className="mt-0.5 flex-none" aria-hidden /> {t("installFirst")}
        </p>
      ) : (
        <>
          <p className="m-0 text-[15px]">{t("promptBody")}</p>
          <button type="button" onClick={turnOn} disabled={busy} className="h-12 cursor-pointer bg-pn-ink text-[16px] font-extrabold text-white disabled:opacity-50">
            {t("turnOn")}
          </button>
          {failed && <p className="m-0 text-[14px] font-semibold text-[#b91c1c]">{t("failed")}</p>}
        </>
      )}
    </div>
  );
}

/** On / off switch for this device: My profile (members) and the bell
 * (staff). Says why when it can't be turned on. */
export function PushToggle({ who, publicKey, compact = false }: { who: "member" | "staff"; publicKey: string; compact?: boolean }) {
  const t = useTranslations("Push");
  const { state, busy, failed, turnOn, turnOff } = usePush(who, publicKey);
  const on = state === "on";
  const canSwitch = state === "on" || state === "off";
  const text = compact ? "text-[12.5px]" : "text-[15px]";
  const note = compact ? "text-[11.5px]" : "text-[13px]";

  return (
    <div className="flex flex-col gap-1">
      <label className={`flex items-center justify-between gap-3 ${text} ${canSwitch ? "cursor-pointer" : ""}`}>
        <span className="flex items-center gap-2 font-semibold">
          <BellRing size={compact ? 14 : 17} aria-hidden /> {t(who === "staff" ? "toggleStaff" : "toggle")}
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={!canSwitch || busy}
          onChange={() => void (on ? turnOff() : turnOn())}
          className={`${compact ? "h-4 w-4" : "h-5 w-5"} flex-none cursor-pointer accent-[#0a5c3c] disabled:cursor-default`}
        />
      </label>
      {state === "on" && <span className={`${note} text-pn-gray-2`}>{t("onNote")}</span>}
      {state === "denied" && <span className={`${note} text-[#b45309]`}>{t("denied")}</span>}
      {state === "unsupported" && <span className={`${note} text-pn-gray-2`}>{t("unsupported")}</span>}
      {state === "needsInstall" && <span className={`${note} text-pn-gray-2`}>{t("installFirst")}</span>}
      {failed && <span className={`${note} font-semibold text-[#b91c1c]`}>{t("failed")}</span>}
    </div>
  );
}
