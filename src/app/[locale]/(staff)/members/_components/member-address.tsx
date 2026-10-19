"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MapPinned, Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { removeMemberAddressAction, saveMemberAddressAction, type MemberAddressState } from "../actions";

export type MemberAddressView = { addressText: string; directions: string | null; latitude: number | null; longitude: number | null; updatedAt: string; updatedByStaff: boolean } | null;

/** The member's primary address on their record: shown, with a map link,
 * and editable by staff. */
export function MemberAddressPanel({ memberId, address, mapLabel }: { memberId: string; address: MemberAddressView; mapLabel: string }) {
  const t = useTranslations("Members");
  const [editing, setEditing] = useState(false);
  const [state, dispatch, pending] = useActionState<MemberAddressState, FormData>(saveMemberAddressAction, null);
  const [v, setV] = useState({
    addressText: address?.addressText ?? "",
    directions: address?.directions ?? "",
    coordinates: address?.latitude != null && address.longitude != null ? `${address.latitude.toFixed(6)}, ${address.longitude.toFixed(6)}` : "",
  });
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.ok) setEditing(false);
  }
  const input = "h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] outline-none focus:border-pn-ink";

  function submit(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("memberId", memberId);
    for (const [k, val] of Object.entries(v)) fd.set(k, val);
    startTransition(() => dispatch(fd));
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="flex flex-col gap-2 text-[13px]">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-pn-gray-1">
          {t("addressText")}
          <textarea value={v.addressText} onChange={(e) => setV((x) => ({ ...x, addressText: e.target.value }))} rows={2} maxLength={300} className="border-2 border-pn-border-muted bg-white p-2 text-[13px] outline-none focus:border-pn-ink" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-pn-gray-1">
          {t("addressDirections")}
          <input value={v.directions} onChange={(e) => setV((x) => ({ ...x, directions: e.target.value }))} maxLength={300} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-pn-gray-1">
          {t("addressCoordinates")}
          <input value={v.coordinates} onChange={(e) => setV((x) => ({ ...x, coordinates: e.target.value }))} placeholder={`14.70330, -17.46350 · 14°42'12"N 17°27'49"W`} className={input} />
        </label>
        {state && !state.ok && <p className="m-0 text-[12px] font-semibold text-[#b91c1c]">{t.has(`addressError.${state.error}`) ? t(`addressError.${state.error}`) : t("addressError.invalid")}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="h-8 cursor-pointer bg-pn-ink px-3 text-xs font-semibold text-white disabled:opacity-50">
            {t("save")}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-8 cursor-pointer px-2 text-xs font-semibold text-pn-gray-1">
            {t("cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-[13px]">
      {address ? (
        <>
          <span className="whitespace-pre-line">{address.addressText}</span>
          {address.directions && <span className="text-pn-gray-1">{address.directions}</span>}
          <span className="flex flex-wrap items-center gap-3 text-[12px]">
            {address.latitude !== null && address.longitude !== null && (
              <Link href={`/map?lat=${address.latitude}&lng=${address.longitude}&radiusKm=10&pointLabel=${encodeURIComponent(mapLabel)}`} className="flex items-center gap-1 font-semibold text-[#0a5c3c]">
                <MapPinned size={12} aria-hidden /> {t("openMap")}
              </Link>
            )}
            <span className="text-pn-gray-3">{t(address.updatedByStaff ? "addressUpdatedStaff" : "addressUpdatedMember", { when: address.updatedAt })}</span>
          </span>
        </>
      ) : (
        <span className="text-pn-gray-3">{t("noAddress")}</span>
      )}
      <span className="flex gap-3 pt-1">
        <button type="button" onClick={() => setEditing(true)} className="flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-pn-gray-1 hover:text-pn-ink">
          <Pencil size={12} aria-hidden /> {address ? t("editAddress") : t("addAddress")}
        </button>
        {address && (
          <form action={removeMemberAddressAction}>
            <input type="hidden" name="memberId" value={memberId} />
            <button type="submit" className="cursor-pointer text-[12px] font-semibold text-[#991b1b] hover:underline">
              {t("removeAddress")}
            </button>
          </form>
        )}
      </span>
    </div>
  );
}
