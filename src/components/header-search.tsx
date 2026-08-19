"use client";

import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Global header search: always searches providers by name/alias/ProviderID/
 * external ID (via `searchProviders`'s full-text `q` filter). Debounced
 * as-you-type navigation, preserving other `/providers` filters when already
 * on that page; from any other route it starts a fresh `/providers?q=...`.
 * usePathname/useRouter come from the locale-aware navigation wrapper (see
 * src/i18n/navigation.ts) so pushed URLs keep the current locale prefix —
 * usePathname already strips it, so the `/providers` comparison below is
 * unaffected by which language is active. */
export function HeaderSearch() {
  const t = useTranslations("Header");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isProvidersPage = pathname === "/providers";
  const urlValue = isProvidersPage ? (searchParams.get("q") ?? "") : "";

  const [value, setValue] = useState(urlValue);
  // Resync from the URL when it changed outside this input (e.g. navigating
  // away, or a filter pill/sort link reload) — adjusting state during render
  // rather than in an effect avoids an extra render on every keystroke.
  const [syncedFrom, setSyncedFrom] = useState(urlValue);
  if (urlValue !== syncedFrom) {
    setSyncedFrom(urlValue);
    setValue(urlValue);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(q: string) {
    const params = isProvidersPage ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("cursors");
    const qs = params.toString();
    router.push(qs ? `/providers?${qs}` : "/providers");
  }

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 400);
  }

  return (
    <div className="flex h-8 max-w-[560px] flex-1 items-center gap-2 border-2 border-pn-gray-1 bg-[#1d2b23] px-2.5">
      <Search size={15} strokeWidth={2} className="text-pn-gray-4" />
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          navigate(value);
        }}
        placeholder={t("searchPlaceholder")}
        className="flex-1 bg-transparent font-[inherit] text-[12.5px] text-white outline-none placeholder:text-pn-gray-4"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setValue("");
            navigate("");
          }}
          aria-label={t("clearSearch")}
          className="cursor-pointer text-pn-gray-4 hover:text-white"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
      <span className="border border-pn-gray-2 px-[5px] text-[10px] tracking-[0.06em] text-pn-gray-4">⌘K</span>
    </div>
  );
}
