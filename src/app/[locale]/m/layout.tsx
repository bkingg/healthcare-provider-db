import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getCurrentMember } from "@/lib/memberAuth";
import { signOutMemberAction } from "./actions";
import { BackHomeButton } from "./_components/back-home-button";
import { NomadHeaderLogo } from "@/components/brand";

export const metadata: Metadata = {
  title: "Nomad",
  description: "Request help from Nomad",
  appleWebApp: { capable: true, title: "Nomad", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#14201a", width: "device-width", initialScale: 1, viewportFit: "cover" };

/** Member app shell (MVP step 1.2): phone-first, separate from the staff
 * layout. Sign-in is checked by the (app) group's layout; the (public)
 * pages (login, link confirmation) render here without it. */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("MemberApp");
  const member = await getCurrentMember();

  return (
    <div className="min-h-full bg-[#f6f7f5] text-[15px] text-pn-ink">
      <header className="sticky top-0 z-10 bg-pn-ink pt-[env(safe-area-inset-top,0px)] text-white">
        {/* Lined up with the page content below, on a phone or a computer. */}
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-3 px-4 lg:max-w-6xl lg:px-6">
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <BackHomeButton />
          </Suspense>
          <NomadHeaderLogo />
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <LocaleSwitcher />
          </Suspense>
          {member && (
            <form action={signOutMemberAction}>
              <button type="submit" aria-label={t("signOut")} title={t("signOut")} className="flex h-10 w-10 cursor-pointer items-center justify-center text-pn-gray-4 hover:text-white">
                <LogOut size={18} />
              </button>
            </form>
          )}
        </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-xl lg:max-w-6xl">{children}</div>
    </div>
  );
}
