import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { LoginForm } from "./_components/login-form";

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
        <div className="mb-5 flex items-center gap-2.5">
          <div className="h-3.5 w-3.5 flex-none bg-pn-accent" />
          <span className="text-sm font-extrabold tracking-[-0.01em]">{t("brand")}</span>
        </div>
        <h1 className="m-0 mb-1 text-lg font-extrabold tracking-[-0.01em]">{t("title")}</h1>
        <p className="mb-5 text-xs text-pn-gray-2">{t("subtitle")}</p>
        <LoginForm />
      </div>
    </div>
  );
}
