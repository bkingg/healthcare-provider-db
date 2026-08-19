"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Columns3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PROVIDER_COLUMNS, useVisibleColumns } from "./column-visibility";

/** Same "click outside to close" dropdown shape used by HeaderSearch and
 * RelatedProviderSearch elsewhere in this app — no menu/popover primitive
 * exists yet in this codebase, so this matches the established pattern
 * rather than introducing a new one. */
export function ColumnsMenu() {
  const t = useTranslations("Search");
  const { visibleColumns, toggleColumn, resetColumns } = useVisibleColumns();
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
        className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
      >
        <Columns3 size={14} /> {t("columns")}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-56 border-2 border-pn-ink bg-white p-2.5">
          <div className="flex flex-col gap-2">
            {PROVIDER_COLUMNS.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label htmlFor={`col-${col.key}`} className="text-[12.5px] font-normal">
                  {t(col.labelKey)}
                </Label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={resetColumns}
            className="mt-2.5 cursor-pointer border-t border-pn-rule pt-2 text-[11px] font-semibold text-pn-gray-2 hover:text-pn-ink"
          >
            {t("resetColumns")}
          </button>
        </div>
      )}
    </div>
  );
}
