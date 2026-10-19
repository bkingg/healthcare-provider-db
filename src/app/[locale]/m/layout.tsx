import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getCurrentMember } from "@/lib/memberAuth";
import { BackHomeButton } from "./_components/back-home-button";
import { MemberMenu } from "./_components/member-menu";
import { formatMemberNumber } from "@/lib/memberNumber";
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
          {member && <MemberMenu name={`${member.firstName} ${member.lastName}`} memberId={formatMemberNumber(member.memberNumber)} covered={member.isCovered} />}
        </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-xl lg:max-w-6xl">{children}</div>
    </div>
  );
}
