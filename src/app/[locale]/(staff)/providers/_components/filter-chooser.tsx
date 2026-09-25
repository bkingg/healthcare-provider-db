"use client";

import { useTranslations } from "next-intl";
import { ListFilter } from "lucide-react";
import { CHECKLIST_FOOTER_BUTTON, ChecklistMenu } from "@/components/checklist-menu";
import { FILTER_GROUPS, defaultFilterOrder, useVisibleFilters, type FilterGroupKey } from "./filter-visibility";

const LABEL_KEYS = Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, g.labelKey])) as Record<FilterGroupKey, (typeof FILTER_GROUPS)[number]["labelKey"]>;

/** Wraps one group of the (server-rendered) Filters panel: drops it when the
 * user has hidden it via FiltersMenu, and positions it (CSS `order` within
 * the panel's flex column) once they've set a custom order — until then
 * the panel's source order is the page's default. A group that currently
 * has a selection applied always stays visible, even if hidden — otherwise
 * the results would be narrowed by a filter the user can't see or clear. */
export function FilterSlot({ filterKey, active, children }: { filterKey: FilterGroupKey; active: boolean; children: React.ReactNode }) {
  const { visible, customOrder } = useVisibleFilters();
  if (!visible.has(filterKey) && !active) return null;
  // +1 so every group sorts after the panel's header and hint (order 0).
  return <div style={customOrder ? { order: customOrder.indexOf(filterKey) + 1 } : undefined}>{children}</div>;
}

/** "Choose filters" checklist in the Filters panel header — the filter
 * counterpart of the results table's Columns menu. */
export function FiltersMenu({ activeKeys, basePath }: { activeKeys: FilterGroupKey[]; basePath: string }) {
  const t = useTranslations("Search");
  const { visible, order, customOrder, toggle, move, reset } = useVisibleFilters(defaultFilterOrder(basePath));
  const customized = visible.size < FILTER_GROUPS.length || customOrder !== null;

  return (
    <ChecklistMenu
      idPrefix="filter"
      button={<ListFilter size={14} />}
      buttonLabel={t("chooseFilters")}
      buttonClassName={`flex h-6 w-6 cursor-pointer items-center justify-center border-2 border-pn-ink hover:bg-pn-surface-hover ${
        customized ? "bg-pn-surface-hover" : "bg-transparent"
      }`}
      items={order.map((key) => ({
        key,
        label: t(LABEL_KEYS[key]),
        checked: visible.has(key),
        // Flags the groups that stay on screen despite being unchecked.
        note: !visible.has(key) && activeKeys.includes(key) ? t("filterInUse") : undefined,
      }))}
      onToggle={(key) => toggle(key as FilterGroupKey)}
      onMove={(key, toIndex) => move(key as FilterGroupKey, toIndex)}
      footer={
        <button type="button" onClick={reset} className={CHECKLIST_FOOTER_BUTTON}>
          {t("resetFilters")}
        </button>
      }
    />
  );
}

/** Shown in place of the groups when the user has hidden every one of them
 * (and none is in use), so the panel isn't just blank. */
export function AllFiltersHiddenHint({ anyActive }: { anyActive: boolean }) {
  const t = useTranslations("Search");
  const { visible, reset } = useVisibleFilters();
  if (visible.size > 0 || anyActive) return null;
  return (
    <div className="px-3.5 py-4 text-[11.5px] leading-relaxed text-pn-gray-3">
      {t("allFiltersHidden")}{" "}
      <button type="button" onClick={reset} className="cursor-pointer font-semibold text-[#0a5c3c]">
        {t("resetFilters")}
      </button>
    </div>
  );
}
