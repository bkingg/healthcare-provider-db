"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AddressFields, type AddressValue } from "../../_components/address-fields";
import { savePrimaryAddressAction, type AddressState } from "../../actions";

/** The member's primary address — after quick start (skippable) or to
 * change it later. Submitted by hand so a failed save keeps what was typed. */
export function PrimaryAddressForm({ initial, welcome }: { initial: AddressValue; welcome: boolean }) {
  const t = useTranslations("MemberAddress");
  const [value, setValue] = useState<AddressValue>(initial);
  const [state, dispatch, pending] = useActionState<AddressState, FormData>(savePrimaryAddressAction, null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("addressText", value.addressText);
    fd.set("directions", value.directions);
    if (value.coords) {
      fd.set("latitude", String(value.coords.lat));
      fd.set("longitude", String(value.coords.lng));
    }
    if (welcome) fd.set("welcome", "1");
    startTransition(() => dispatch(fd));
  }

  const error = state && !state.ok ? <p role="alert" className="m-0 text-[14px] font-semibold text-[#b91c1c]">{t.has(`error.${state.error}`) ? t(`error.${state.error}`) : t("error.other")}</p> : null;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <AddressFields value={value} onChange={setValue} addressError={error} addressLabel={t("addressLabel")} />
      <button type="submit" disabled={pending} className="mt-2 h-12 cursor-pointer bg-pn-accent text-[16px] font-bold text-white active:bg-pn-accent-hover disabled:opacity-50">
        {pending ? t("saving") : t("save")}
      </button>
      {welcome && (
        <Link href="/m?welcome=1" className="flex h-12 items-center justify-center border-2 border-pn-border-muted bg-white text-[15px] font-semibold text-pn-gray-1 no-underline">
          {t("skip")}
        </Link>
      )}
    </form>
  );
}
