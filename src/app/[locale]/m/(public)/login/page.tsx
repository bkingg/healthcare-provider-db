import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentMember } from "@/lib/memberAuth";
import { EmergencyPanel } from "../../_components/emergency-panel";
import { LoginForm } from "./login-form";
import { NomadLogo } from "@/components/brand";

export default async function MemberLoginPage() {
  const t = await getTranslations("MemberApp");
  if (await getCurrentMember()) redirect({ href: "/m", locale: await getLocale() });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <NomadLogo height={96} className="self-center" />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{t("loginTitle")}</h1>
        <p className="m-0 text-[15px] text-pn-gray-1">{t("loginIntro")}</p>
      </div>
      <LoginForm />
      {/* Anyone can see the emergency numbers — no sign-in needed, and with
       * no member known yet, every active number is shown. */}
      <EmergencyPanel countryId={undefined} />
    </main>
  );
}
