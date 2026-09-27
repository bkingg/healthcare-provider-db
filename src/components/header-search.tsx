"use client";

import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type SearchScope = "providers" | "cases" | "members";

/** Global header search. What it searches follows where you are: on the
 * Cases screens it searches cases (name, case number, member ID, request
 * type, phone), on the Members screens members (name, member ID, email,
 * phone, policy), and everywhere else providers (name, alias, ProviderID,
 * external ID). A small selector inside the box shows the current target
 * and switches it — e.g. to look up a provider while working a case —
 * offering only the areas the staff member's role can open.
 *
 * Debounced as-you-type navigation to `/<scope>?q=…`, preserving that list's
 * other filters when already on it; from any other page it starts fresh.
 * usePathname/useRouter come from the locale-aware navigation wrapper (see
 * src/i18n/navigation.ts) so pushed URLs keep the current locale prefix. */
export function HeaderSearch({ scopes }: { scopes: SearchScope[] }) {
  const t = useTranslations("Header");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageScope: SearchScope =
    pathname.startsWith("/cases") && scopes.includes("cases") ? "cases" : pathname.startsWith("/members") && scopes.includes("members") ? "members" : "providers";
  // The target follows the page; the selector can point it elsewhere until
  // the next page change (adjusted during render, not in an effect).
  const [scope, setScope] = useState<SearchScope>(pageScope);
  const [scopeFrom, setScopeFrom] = useState(pageScope);
  if (pageScope !== scopeFrom) {
    setScopeFrom(pageScope);
    setScope(pageScope);
  }

  const onScopeList = pathname === `/${scope}`;
  const urlValue = onScopeList ? (searchParams.get("q") ?? "") : "";
  const [value, setValue] = useState(urlValue);
  // Resync from the URL when it changed outside this input (e.g. navigating
  // away, or a filter link reload).
  const [syncedFrom, setSyncedFrom] = useState(urlValue);
  if (urlValue !== syncedFrom) {
    setSyncedFrom(urlValue);
    setValue(urlValue);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(q: string, target: SearchScope = scope) {
    const onTargetList = pathname === `/${target}`;
    const params = onTargetList ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("cursors");
    const qs = params.toString();
    router.push(qs ? `/${target}?${qs}` : `/${target}`);
  }

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 400);
  }

  const placeholder = scope === "cases" ? t("searchCasesPlaceholder") : scope === "members" ? t("searchMembersPlaceholder") : t("searchPlaceholder");

  return (
    <div role="search" className="flex h-8 max-w-[560px] flex-1 items-center gap-2 border-2 border-pn-gray-1 bg-[#1d2b23] pr-2.5">
      {scopes.length > 1 ? (
        <select
          value={scope}
          aria-label={t("searchIn")}
          onChange={(e) => {
            const next = e.target.value as SearchScope;
            setScope(next);
            // Carry what's already typed over to the new target.
            if (value) navigate(value, next);
          }}
          className="h-full cursor-pointer border-r border-pn-gray-2 bg-[#26362d] px-2 text-[11px] font-bold tracking-[0.04em] text-white uppercase outline-none"
        >
          {scopes.map((s) => (
            <option key={s} value={s}>
              {t(`scope.${s}`)}
            </option>
          ))}
        </select>
      ) : (
        <span className="pl-2.5" />
      )}
      <Search size={15} strokeWidth={2} className="flex-none text-pn-gray-4" aria-hidden />
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          navigate(value);
        }}
        aria-label={placeholder}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-[inherit] text-[12.5px] text-white outline-none placeholder:text-pn-gray-4"
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
