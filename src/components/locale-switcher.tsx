"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = { en: "EN", fr: "FR" };

/** URL-prefix locale switcher (/en/... ↔ /fr/...). usePathname (from the
 * locale-aware navigation wrapper) already returns the fully-resolved path
 * without the locale prefix, so re-pushing it under a different `locale`
 * option keeps the user on the exact same page — a French user on a
 * provider profile stays on that profile after switching, not bounced to
 * search. Query string is preserved separately since usePathname excludes it. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function switchTo(nextLocale: string) {
    const qs = searchParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: nextLocale });
  }

  return (
    <div className="flex items-center border-2 border-pn-gray-1">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-current={l === locale}
          onClick={() => switchTo(l)}
          className={`h-[26px] cursor-pointer px-2 text-[11px] font-bold tracking-[0.04em] ${
            l === locale ? "bg-pn-accent text-white" : "bg-transparent text-pn-gray-4 hover:text-white"
          }`}
        >
          {LOCALE_LABELS[l] ?? l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
