import { getTranslations } from "next-intl/server";
import { getCurrentActor } from "@/lib/actor";
import { ChangePasswordForm } from "./_components/change-password-form";

export default async function ChangePasswordPage() {
  const actor = await getCurrentActor();
  const t = await getTranslations("ChangePassword");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-8">
      <div>
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-[5px] text-xs text-pn-gray-2">
          {actor.mustChangePassword ? t("forcedSubtitle") : t("voluntarySubtitle")}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
