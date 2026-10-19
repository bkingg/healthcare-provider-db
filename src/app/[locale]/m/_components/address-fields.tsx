"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Info, LocateFixed } from "lucide-react";

export type AddressValue = { addressText: string; directions: string; coords: { lat: number; lng: number } | null };

/** Where to find the member: "Share my location" first (one tap gives the
 * courier the exact spot), then the written address (what a pin can't
 * say: villa, floor, landmark), then directions. Used by the medication
 * order and the primary address screen. Controlled by the parent. */
export function AddressFields({ value, onChange, addressError, addressLabel }: { value: AddressValue; onChange: (v: AddressValue) => void; addressError?: React.ReactNode; addressLabel?: string }) {
  const t = useTranslations("MemberOrder");
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const input = "h-12 border-2 border-pn-border-muted bg-white px-3 text-[16px] outline-none focus:border-pn-ink";

  function useMyLocation() {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ ...value, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <>
      {!value.coords && (
        <p id="locationWhy" className="m-0 flex items-start gap-2 border-l-4 border-pn-accent bg-pn-accent-soft px-3 py-2 text-[14px] text-[#08432c]">
          <Info size={16} className="mt-0.5 flex-none" aria-hidden />
          <span>
            <strong>{t("locationWhyTitle")}</strong> {t("locationWhy")}
          </span>
        </p>
      )}
      <button
        type="button"
        aria-describedby={value.coords ? undefined : "locationWhy"}
        onClick={useMyLocation}
        disabled={locating === "busy"}
        className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 border-2 px-4 text-[15px] font-semibold ${value.coords ? "border-pn-accent bg-pn-accent-soft text-[#08432c]" : "border-pn-ink bg-white"}`}
      >
        {value.coords ? <Check size={18} /> : <LocateFixed size={18} />}
        {value.coords ? t("locationSharedDone") : locating === "busy" ? t("locating") : t("shareLocation")}
      </button>
      {locating === "denied" && <p className="m-0 text-[14px] text-pn-gray-1">{t("locationDenied")}</p>}
      <label className="mt-2 text-[14px] font-semibold" htmlFor="address">
        {addressLabel ?? t("address")}
      </label>
      <p id="addressHelp" className="m-0 -mt-1 text-[13px] text-pn-gray-1">
        {t("addressHelp")}
      </p>
      <textarea
        id="address"
        rows={3}
        maxLength={300}
        value={value.addressText}
        onChange={(e) => onChange({ ...value, addressText: e.target.value })}
        placeholder={t("addressPlaceholder")}
        aria-describedby="addressHelp"
        className="border-2 border-pn-border-muted bg-white p-3 text-[16px] outline-none focus:border-pn-ink"
      />
      {addressError}
      <label className="text-[14px] font-semibold" htmlFor="deliveryNotes">
        {t("deliveryNotes")}
      </label>
      <input id="deliveryNotes" maxLength={300} value={value.directions} onChange={(e) => onChange({ ...value, directions: e.target.value })} placeholder={t("deliveryNotesPlaceholder")} className={input} />
    </>
  );
}
