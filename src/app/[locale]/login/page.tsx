import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { LoginForm } from "./_components/login-form";
import { NomadLogo } from "@/components/brand";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    const locale = await getLocale();
    redirect({ href: "/providers", locale });
  }

  const t = await getTranslations("Login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-pn-panel p-6">
      <div className="w-full max-w-sm border-2 border-pn-ink bg-white p-6">
        <div className="mb-5 flex flex-col items-center gap-2">
          <NomadLogo height={92} />
          <span className="text-[11px] font-semibold tracking-[0.14em] text-pn-gray-2 uppercase">{t("brand")}</span>
        </div>
        <h1 className="m-0 mb-1 text-lg font-extrabold tracking-[-0.01em]">{t("title")}</h1>
        <p className="mb-5 text-xs text-pn-gray-2">{t("subtitle")}</p>
        <LoginForm />
      </div>
    </div>
  );
}
