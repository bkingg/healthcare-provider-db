import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getCurrentMember } from "@/lib/memberAuth";
import { signOutMemberAction } from "./actions";

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
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 bg-pn-ink px-4 pt-[env(safe-area-inset-top,0px)] text-white">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 bg-pn-accent" aria-hidden />
          <span className="text-[17px] font-extrabold tracking-[-0.01em]">Nomad</span>
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
      </header>
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  );
}
