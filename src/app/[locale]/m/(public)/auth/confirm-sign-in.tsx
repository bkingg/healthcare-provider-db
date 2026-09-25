"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { redeemLoginLinkAction } from "../../actions";

export function ConfirmSignIn({ token }: { token: string }) {
  const t = useTranslations("MemberApp");
  const [state, action, pending] = useActionState(redeemLoginLinkAction, null);

  if (!token || state?.failed) {
    return (
      <div role="alert" className="flex flex-col gap-3">
        <p className="m-0 text-[15px]">{t("linkInvalid")}</p>
        <Link href="/m/login" className="flex h-12 items-center justify-center bg-pn-ink text-[16px] font-bold text-white">
          {t("getNewLink")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="m-0 text-[15px] text-pn-gray-1">{t("confirmBody")}</p>
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="h-12 cursor-pointer bg-pn-accent text-[16px] font-bold text-white disabled:opacity-50">
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
