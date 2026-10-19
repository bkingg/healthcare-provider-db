import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentMember } from "@/lib/memberAuth";
import { EmergencyPanel } from "../../_components/emergency-panel";
import { LoginForm } from "./login-form";
import { PhoneSignIn } from "./phone-sign-in";
import { allowedCodeCountries } from "@/lib/phoneSignIn";
import { countryCallingCode } from "@/lib/phone";
import { memberFeatures } from "@/data/memberAppFeatures";
import { NomadLogo } from "@/components/brand";

export default async function MemberLoginPage() {
  const t = await getTranslations("MemberApp");
  const tSign = await getTranslations("MemberSignIn");
  if (await getCurrentMember()) redirect({ href: "/m", locale: await getLocale() });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <NomadLogo height={96} className="self-center" />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{t("loginTitle")}</h1>
        <p className="m-0 text-[15px] text-pn-gray-1">{t("loginIntro")}</p>
      </div>
      {/* WhatsApp code first; email stays as a backup (members abroad,
       * or without a phone Nomad can reach). */}
      {/* A quick-start account starts without cover. */}
      <PhoneSignIn requestHelp={(await memberFeatures({ isCovered: false })).REQUEST_HELP} countries={allowedCodeCountries().map((iso2) => ({ iso2, callingCode: countryCallingCode(iso2) ?? "", name: iso2 }))} />
      <details className="group border-t border-pn-rule pt-3">
        <summary className="cursor-pointer text-[14px] font-semibold text-pn-gray-1 underline">{tSign("useEmail")}</summary>
        <div className="mt-3">
          <LoginForm />
        </div>
      </details>
      {/* Anyone can see the emergency numbers — no sign-in needed, and with
       * no member known yet, every active number is shown. */}
      <EmergencyPanel countryId={undefined} />
    </main>
  );
}
