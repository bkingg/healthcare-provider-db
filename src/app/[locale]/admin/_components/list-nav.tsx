"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { REFERENCE_LIST_KEYS, type ReferenceListKey } from "@/lib/referenceListDefs";
import { Input } from "@/components/ui/input";

/** Lists that belong to another list and are shown nested under it: the
 * healthcare-system rating scale is managed from Countries, the screen where
 * each country is assigned one of its values. */
const CHILD_OF: Partial<Record<ReferenceListKey, ReferenceListKey>> = { ratingScales: "countries" };

/** Left panel of the admin tab: every reference list, filtered client-side
 * by translated label (there are ~20 of them — a full page round-trip per
 * keystroke would be overkill) and linking to `/admin?list=<key>`, which the
 * page reads server-side to pick which list's items to render. */
export function ListNav({ selectedKey }: { selectedKey: ReferenceListKey }) {
  const t = useTranslations("Admin");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = REFERENCE_LIST_KEYS.filter((key) => t(`lists.${key}`).toLowerCase().includes(q));
  // A nested list is shown under its parent — or on its own if a search
  // filtered the parent out.
  const topLevel = filtered.filter((key) => {
    const parent = CHILD_OF[key];
    return !parent || !filtered.includes(parent);
  });

  return (
    <nav className="flex w-[240px] flex-none flex-col overflow-auto border-r-2 border-pn-ink bg-white">
      <div className="border-b-2 border-pn-ink p-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchListsPlaceholder")}
        />
      </div>
      <div className="flex-1 overflow-auto py-1">
        {filtered.length === 0 && <p className="px-4 py-2 text-xs text-pn-gray-3">{t("noListsFound")}</p>}
        {topLevel.map((key) => (
          <div key={key}>
            <NavLink listKey={key} selectedKey={selectedKey} label={t(`lists.${key}`)} />
            {filtered
              .filter((child) => CHILD_OF[child] === key)
              .map((child) => (
                <NavLink key={child} listKey={child} selectedKey={selectedKey} label={t(`lists.${child}`)} nested />
              ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function NavLink({ listKey, selectedKey, label, nested }: { listKey: ReferenceListKey; selectedKey: ReferenceListKey; label: string; nested?: boolean }) {
  return (
    <Link
      href={`/admin?list=${listKey}`}
      className={`block border-l-4 py-2 pr-4 text-[12.5px] hover:bg-pn-surface-hover ${nested ? "pl-8 text-pn-gray-2" : "pl-4"} ${
        listKey === selectedKey ? "border-pn-accent bg-pn-surface-hover font-bold" : "border-transparent font-medium"
      }`}
    >
      {nested ? "↳ " : ""}
      {label}
    </Link>
  );
}
