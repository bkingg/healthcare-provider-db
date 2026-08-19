"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_TRIGGER_CLASS } from "@/components/ref-select";

type RefOption = { id: string; label: string };

/** Multi-select twin of RefSelect: same flat look and `{ id, label }` options,
 * but the user can tick several values. The dropdown stays open while ticking;
 * the current picks show as removable chips under it. Submits as repeated
 * `name` entries (`formData.getAll(name)`) via hidden inputs, the same shape
 * the taxonomy checkbox forms use, so it works inside a plain
 * `<form action={serverAction}>`. */
export function MultiRefSelect({
  name,
  options,
  defaultValue = [],
  placeholder = "Select…",
}: {
  name: string;
  options: RefOption[];
  defaultValue?: string[];
  placeholder?: string;
}) {
  const [value, setValue] = useState<string[]>(defaultValue);
  const items = options.map((o) => ({ value: o.id, label: o.label }));
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-1.5">
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <Select multiple value={value} onValueChange={(v) => setValue(v as string[])} items={items}>
        <SelectTrigger className={DEFAULT_TRIGGER_CLASS}>
          <SelectValue>
            {(v: string[]) =>
              v.length === 0 ? <span className="text-pn-gray-3">{placeholder}</span> : <span className="truncate">{v.map(labelOf).join(", ")}</span>
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-none border-2 border-pn-ink shadow-none ring-0">
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="rounded-none text-[12.5px] focus:bg-pn-surface-hover focus:text-pn-ink">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="flex items-center gap-1 border border-pn-border-muted px-1.5 py-px text-[11.5px] text-pn-ink">
              {labelOf(v)}
              <button
                type="button"
                aria-label={`Remove ${labelOf(v)}`}
                onClick={() => setValue((prev) => prev.filter((x) => x !== v))}
                className="cursor-pointer text-pn-gray-3 hover:text-pn-ink"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
