"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { REFERENCE_LIST_GROUPS, REFERENCE_LIST_KEYS, type ReferenceListKey } from "@/lib/referenceListDefs";
import { Input } from "@/components/ui/input";

/** Lists that belong to another list and are shown nested under it: the
 * healthcare-system rating scale is managed from Countries, the screen where
 * each country is assigned one of its values. */
const CHILD_OF: Partial<Record<ReferenceListKey, ReferenceListKey>> = { ratingScales: "countries" };

/** Left panel of the admin tab: every reference list, grouped by what it's
 * for (REFERENCE_LIST_GROUPS — member app, member enrollment, provider
 * info…), filtered client-side by translated label (a full page round-trip
 * per keystroke would be overkill) and linking to `/admin?list=<key>`, which
 * the page reads server-side to pick which list's items to render. A group
 * with no list matching the search is hidden. */
export function ListNav({ selectedKey }: { selectedKey: ReferenceListKey }) {
  const t = useTranslations("Admin");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Collapsible groups: the one holding the list being viewed starts open
  // (and opens again when you navigate into a closed group); while
  // searching, every group with a match is shown open.
  const groupOf = (key: ReferenceListKey) => REFERENCE_LIST_GROUPS.find((g) => (g.lists as readonly ReferenceListKey[]).includes(key))?.key;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([groupOf(selectedKey) ?? ""]));
  const [prevSelected, setPrevSelected] = useState(selectedKey);
  if (prevSelected !== selectedKey) {
    setPrevSelected(selectedKey);
    const g = groupOf(selectedKey);
    if (g && !openGroups.has(g)) setOpenGroups(new Set([...openGroups, g]));
  }
  const searching = q.length > 0;
  const allOpen = REFERENCE_LIST_GROUPS.every((g) => openGroups.has(g.key));
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
        {!searching && (
          <button
            type="button"
            onClick={() => setOpenGroups(allOpen ? new Set() : new Set(REFERENCE_LIST_GROUPS.map((g) => g.key)))}
            className="mt-2 cursor-pointer text-[11px] font-semibold text-[#0a5c3c] hover:underline"
          >
            {allOpen ? t("listGroups.collapseAll") : t("listGroups.expandAll")}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto py-1">
        {filtered.length === 0 && <p className="px-4 py-2 text-xs text-pn-gray-3">{t("noListsFound")}</p>}
        {REFERENCE_LIST_GROUPS.map((group) => {
          // In the group's own order, not the master list's.
          const inGroup = (group.lists as readonly ReferenceListKey[]).filter((key) => topLevel.includes(key));
          if (inGroup.length === 0) return null;
          const isOpen = searching || openGroups.has(group.key);
          const listCount = inGroup.length + filtered.filter((child) => CHILD_OF[child] && inGroup.includes(CHILD_OF[child]!)).length;
          return (
            <section key={group.key} aria-labelledby={`list-group-${group.key}`} className="border-b border-pn-rule last:border-b-0">
              <h2 className="m-0">
                <button
                  type="button"
                  id={`list-group-${group.key}`}
                  aria-expanded={isOpen}
                  aria-controls={`list-group-${group.key}-items`}
                  disabled={searching}
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left text-[10.5px] font-bold tracking-[0.1em] text-pn-gray-2 uppercase hover:bg-pn-surface-hover hover:text-pn-ink disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {isOpen ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                  <span className="flex-1">{t(`listGroups.${group.key}`)}</span>
                  <span className="text-[10px] font-semibold tracking-normal text-pn-gray-3 tabular-nums">{listCount}</span>
                </button>
              </h2>
              <div id={`list-group-${group.key}-items`} hidden={!isOpen} className="pb-1">
                {inGroup.map((key) => (
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
            </section>
          );
        })}
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
