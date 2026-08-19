"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RefOption = { id: string; label: string };

/** Mockup's flat field look (2px ink border, no radius, dense text) — the
 * default for every dropdown in the app, so filter pills, wizard fields, and
 * every CRUD section's <select>-equivalents stay visually consistent. */
export const DEFAULT_TRIGGER_CLASS =
  "flex h-[30px] w-full items-center justify-between gap-1.5 rounded-none border-2 border-pn-border-muted bg-white px-2 font-[inherit] text-[12.5px] text-pn-ink shadow-none outline-none data-placeholder:text-pn-gray-3 hover:border-pn-ink hover:bg-white focus-visible:border-pn-ink focus-visible:ring-0 active:border-pn-ink data-open:border-pn-ink";

/** Shared wrapper around the shadcn/Base UI Select for the ~15 foreign-key
 * dropdowns across the provider forms (country, provider type, specialty,
 * ...), all sourced from `src/data/referenceData.ts`. Base UI's Select
 * associates with native forms via its `name` prop (renders a hidden input),
 * so this still works inside a plain `<form action={serverAction}>`.
 *
 * Passes `items` to Select.Root so `<Select.Value>` renders the matched
 * option's *label* instead of the raw id — without it, Base UI has no way to
 * resolve display text and falls back to showing the underlying value
 * (the option's uuid) once one is selected. */
export function RefSelect({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  required,
  triggerClassName,
}: {
  name: string;
  options: RefOption[];
  /** Controlled selection — for the rare caller (e.g. the phone country
   * picker) that needs to react to a change rather than just read it back
   * from FormData on submit. Every other caller sticks with defaultValue. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Overrides the trigger's default flat styling, for spots that need a
   * different size/variant. Rarely needed — the default already matches the
   * design system. */
  triggerClassName?: string;
}) {
  const items = options.map((o) => ({ value: o.id, label: o.label }));

  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange ? (v) => onValueChange(v ?? "") : undefined}
      required={required}
      items={items}
    >
      <SelectTrigger className={triggerClassName ?? DEFAULT_TRIGGER_CLASS}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-none border-2 border-pn-ink shadow-none ring-0">
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id} className="rounded-none text-[12.5px] focus:bg-pn-surface-hover focus:text-pn-ink">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
