"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Columns3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/referenceListDefs";
import { useExtraColumns } from "./reference-column-visibility";
import type { ReferenceListKey } from "@/lib/referenceListDefs";

/** Same "click outside to close" dropdown shape as the providers results
 * table's ColumnsMenu (columns-menu.tsx) — no menu/popover primitive exists
 * in this codebase, so this matches that established pattern.
 *
 * Lets an admin add any of the value list's own form fields (e.g. a
 * specialty's French name) as extra columns on the main list table, so every
 * row's value is visible at a glance instead of opening each item's edit
 * dialog one at a time. */
export function ColumnChooser({ listKey, fields }: { listKey: ReferenceListKey; fields: FieldDef[] }) {
  const t = useTranslations("Admin");
  const { visibleColumns, toggleColumn, clearColumns } = useExtraColumns(listKey);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-7 cursor-pointer items-center gap-[6px] border-2 border-pn-ink bg-transparent px-2.5 text-[11px] font-semibold hover:bg-pn-surface-hover"
      >
        <Columns3 size={13} /> {t("columns")}
        {visibleColumns.size > 0 && <span className="text-pn-gray-2">({visibleColumns.size})</span>}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-60 border-2 border-pn-ink bg-white p-2.5">
          <div className="mb-1.5 text-[10px] tracking-[0.08em] text-pn-gray-3 uppercase">{t("columnsHint")}</div>
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {fields.map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <Checkbox id={`admin-col-${field.key}`} checked={visibleColumns.has(field.key)} onCheckedChange={() => toggleColumn(field.key)} />
                <Label htmlFor={`admin-col-${field.key}`} className="text-[12.5px] font-normal">
                  {t(`fields.${field.labelKey}`)}
                </Label>
              </div>
            ))}
          </div>
          {visibleColumns.size > 0 && (
            <button
              type="button"
              onClick={clearColumns}
              className="mt-2.5 cursor-pointer border-t border-pn-rule pt-2 text-[11px] font-semibold text-pn-gray-2 hover:text-pn-ink"
            >
              {t("clearColumns")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
