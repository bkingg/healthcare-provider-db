"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { staffLabel } from "@/lib/handle";

export type Worker = { id: string; name: string | null; email: string; handle: string };

/** Type-to-search replacement for the "Assigned to" select: matches the
 * typed text against each case worker's @handle and name ("@jer", "jerome"
 * and "diallo" all find Jerome Diallo). Submits the chosen id as `name`
 * ("assigneeId" by default; "" = unassigned), same as the select it
 * replaces. Also picks a next action's owner (`allowNone` off — an action
 * always has one). */
export function AssigneePicker({
  workers,
  defaultId,
  meId,
  name = "assigneeId",
  allowNone = true,
  label,
  widthClass = "w-[260px]",
}: {
  workers: Worker[];
  defaultId: string | null;
  meId: string;
  name?: string;
  allowNone?: boolean;
  label?: string;
  widthClass?: string;
}) {
  const t = useTranslations("Cases");
  const listId = useId();
  const [selectedId, setSelectedId] = useState(defaultId ?? "");
  const labelFor = (wid: string) => {
    const w = workers.find((x) => x.id === wid);
    return w ? staffLabel(w) + (w.id === meId ? ` (${t("me")})` : "") : "";
  };
  const [text, setText] = useState(labelFor(defaultId ?? ""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = text.trim().toLowerCase().replace(/^@/, "");
  // While the box still shows the current choice, list everyone.
  const filtering = open && text !== labelFor(selectedId);
  const matches = filtering && q ? workers.filter((w) => w.handle.includes(q) || (w.name ?? w.email).toLowerCase().includes(q)) : workers;
  const options: { id: string; label: string; handle?: string }[] = [
    ...(!allowNone || (filtering && q) ? [] : [{ id: "", label: t("unassigned") }]),
    ...matches.map((w) => ({ id: w.id, label: (w.name ?? w.email) + (w.id === meId ? ` (${t("me")})` : ""), handle: w.handle })),
  ];

  function pick(id: string) {
    setSelectedId(id);
    setText(id ? labelFor(id) : "");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <input
        role="combobox"
        aria-label={label ?? t("assignedTo")}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        value={text}
        placeholder={t("assigneeSearch")}
        onFocus={(e) => {
          setOpen(true);
          setActive(0);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          // Leaving without picking puts the current choice back.
          setOpen(false);
          setText(labelFor(selectedId));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open) {
            // Choose the highlighted person instead of submitting the form.
            e.preventDefault();
            if (options[active]) pick(options[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
            setText(labelFor(selectedId));
          }
        }}
        className={`h-8 ${widthClass} border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case outline-none focus:border-pn-ink`}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-20 mt-0.5 max-h-64 w-[320px] overflow-auto border-2 border-pn-ink bg-white py-0.5 tracking-normal normal-case shadow-md">
          {options.length === 0 && <li className="px-2 py-1.5 text-[12.5px] text-pn-gray-3">{t("assigneeNoMatch")}</li>}
          {options.map((o, i) => (
            <li
              key={o.id || "none"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.id === selectedId}
              // mousedown, not click: runs before the input's blur resets it.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o.id);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-2 px-2 py-1.5 text-[12.5px] ${i === active ? "bg-pn-surface-hover" : ""} ${o.id === selectedId ? "font-semibold" : ""}`}
            >
              <span className="truncate text-pn-ink">{o.label}</span>
              {o.handle && <span className="flex-none text-[11.5px] text-pn-gray-2">@{o.handle}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
