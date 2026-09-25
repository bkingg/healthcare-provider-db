"use client";

import { useTranslations } from "next-intl";
import { Columns3 } from "lucide-react";
import { CHECKLIST_FOOTER_BUTTON, ChecklistMenu } from "@/components/checklist-menu";
import { usePanelWidths } from "@/lib/panel-widths";
import { PROVIDER_COLUMNS, isLockedColumn, useVisibleColumns, type ProviderColumnKey } from "./column-visibility";

const LABEL_KEY = Object.fromEntries(PROVIDER_COLUMNS.map((c) => [c.key, c.labelKey])) as Record<
  ProviderColumnKey,
  (typeof PROVIDER_COLUMNS)[number]["labelKey"]
>;

export function ColumnsMenu() {
  const t = useTranslations("Search");
  const { visibleColumns, columnOrder, toggleColumn, moveColumn, resetColumns } = useVisibleColumns();
  const { widths, resetColumnWidths } = usePanelWidths();
  const hasCustomWidths = Object.keys(widths).some((k) => k.startsWith("col:"));

  return (
    <ChecklistMenu
      idPrefix="col"
      button={
        <>
          <Columns3 size={14} /> {t("columns")}
        </>
      }
      buttonClassName="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
      items={columnOrder.map((key) => ({
        key,
        label: t(LABEL_KEY[key]),
        checked: visibleColumns.has(key),
        locked: isLockedColumn(key),
      }))}
      onToggle={(key) => toggleColumn(key as ProviderColumnKey)}
      onMove={(key, toIndex) => moveColumn(key as ProviderColumnKey, toIndex)}
      footer={
        <>
          <button type="button" onClick={resetColumns} className={CHECKLIST_FOOTER_BUTTON}>
            {t("resetColumns")}
          </button>
          {hasCustomWidths && (
            <button type="button" onClick={resetColumnWidths} className={CHECKLIST_FOOTER_BUTTON}>
              {t("resetColumnWidths")}
            </button>
          )}
        </>
      }
    />
  );
}
