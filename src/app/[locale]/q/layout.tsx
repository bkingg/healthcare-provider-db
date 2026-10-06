import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { LocaleSwitcher } from "@/components/locale-switcher";

export const metadata: Metadata = { title: "Nomad — devis pharmacie", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#14201a", width: "device-width", initialScale: 1 };

/** The pharmacy quote page's frame: phone-first, no sign-in, not indexed. */
export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#f6f7f5] text-[15px] text-pn-ink">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 bg-pn-ink px-4 text-white">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 bg-pn-accent" aria-hidden />
          <span className="text-[17px] font-extrabold tracking-[-0.01em]">Nomad</span>
        </div>
        <Suspense fallback={null}>
          <LocaleSwitcher />
        </Suspense>
      </header>
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}
