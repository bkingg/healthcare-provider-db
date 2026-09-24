"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type ChecklistItem = {
  key: string;
  label: string;
  checked: boolean;
  note?: string;
  /** Can be reordered but not unchecked (e.g. the Provider name column). */
  locked?: boolean;
};

/** Where a dragged row would land: the insertion slot (0 = above the first
 * row, items.length = below the last) nearest the pointer, found by
 * comparing it with each row's vertical midpoint. */
function insertionSlot(rows: Element[], clientY: number): number {
  let slot = 0;
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (clientY > r.top + r.height / 2) slot++;
  }
  return slot;
}

/** Show/hide + reorder checklist dropdown — the results table's Columns menu
 * and the Filters panel's filter chooser. Built on Base UI's Popover so the
 * popup is portalled to the document body: the Filters panel scrolls its
 * content (`overflow-auto`), and an in-place absolutely-positioned dropdown
 * got clipped by the panel's edges whenever the panel was narrower than the
 * menu. The positioner also flips/shifts the popup to stay inside the
 * viewport, and Popover brings Escape-to-close, outside-click dismissal and
 * focus management with it.
 *
 * Rows are reordered by dragging their grip (pointer events, so mouse, pen
 * and touch all work) or, from the keyboard, focusing the grip and pressing
 * the up/down arrow keys. */
export function ChecklistMenu({
  idPrefix,
  button,
  buttonClassName,
  buttonLabel,
  items,
  onToggle,
  onMove,
  footer,
}: {
  idPrefix: string;
  button: React.ReactNode;
  buttonClassName: string;
  /** Accessible name, for icon-only buttons. */
  buttonLabel?: string;
  /** In display order. */
  items: ChecklistItem[];
  onToggle: (key: string) => void;
  /** Moves `key` to position `toIndex` in the list. */
  onMove: (key: string, toIndex: number) => void;
  footer: React.ReactNode;
}) {
  const t = useTranslations("Common");
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ key: string; from: number; slot: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Grip to re-focus after a keyboard move — React may re-insert the moved
  // row's DOM node, which drops focus.
  const refocusKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!refocusKey.current) return;
    listRef.current?.querySelector<HTMLElement>(`[data-grip="${CSS.escape(refocusKey.current)}"]`)?.focus();
    refocusKey.current = null;
  });

  function moveTo(key: string, label: string, toIndex: number) {
    onMove(key, toIndex);
    setAnnouncement(t("movedItem", { item: label, position: toIndex + 1, total: items.length }));
  }

  function rows(): Element[] {
    return listRef.current ? [...listRef.current.querySelectorAll("[data-row]")] : [];
  }

  function onGripPointerDown(e: React.PointerEvent<HTMLButtonElement>, key: string, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ key, from: index, slot: index });
  }

  function onGripPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const slot = insertionSlot(rows(), e.clientY);
    if (slot !== drag.slot) setDrag({ ...drag, slot });
  }

  function onGripPointerUp(e: React.PointerEvent<HTMLButtonElement>, label: string) {
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Slots count the dragged row itself, so dropping below it lands one
    // position earlier once it's taken out of the list.
    const toIndex = drag.slot > drag.from ? drag.slot - 1 : drag.slot;
    if (toIndex !== drag.from) moveTo(drag.key, label, toIndex);
    setDrag(null);
  }

  function onGripKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, key: string, label: string, index: number) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const toIndex = index + (e.key === "ArrowUp" ? -1 : 1);
    if (toIndex < 0 || toIndex >= items.length) return;
    refocusKey.current = key;
    moveTo(key, label, toIndex);
  }

  return (
    <Popover.Root onOpenChange={(open) => !open && setDrag(null)}>
      <Popover.Trigger aria-label={buttonLabel} title={buttonLabel} className={buttonClassName}>
        {button}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-[100]">
          {/* Sized to its content (so longer French labels fit on one line)
           * within 200–280px, and never wider than the space the positioner
           * reports as available. */}
          <Popover.Popup className="w-max max-w-[min(280px,var(--available-width))] min-w-[200px] border-2 border-pn-ink bg-white p-2.5 text-left outline-none">
            <div ref={listRef} className={`flex flex-col gap-0.5 ${drag ? "cursor-grabbing" : ""}`}>
              {items.map((item, index) => {
                const dragging = drag?.key === item.key;
                // Drop indicator: a line above the row at the insertion slot,
                // or below the last row when dropping at the very end —
                // skipped when the drop wouldn't move anything.
                const showLineAbove = drag && drag.slot === index && drag.slot !== drag.from && drag.slot !== drag.from + 1;
                const showLineBelow = drag && index === items.length - 1 && drag.slot === items.length && drag.from !== items.length - 1;
                return (
                  <div
                    key={item.key}
                    data-row
                    className={`relative flex items-center gap-1.5 py-[3px] ${dragging ? "bg-pn-surface-hover opacity-60" : ""} ${
                      showLineAbove ? "before:absolute before:inset-x-0 before:-top-[2px] before:h-[3px] before:bg-pn-accent" : ""
                    } ${showLineBelow ? "after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[3px] after:bg-pn-accent" : ""}`}
                  >
                    <button
                      type="button"
                      data-grip={item.key}
                      aria-label={t("reorderItem", { item: item.label })}
                      title={t("reorderItem", { item: item.label })}
                      onPointerDown={(e) => onGripPointerDown(e, item.key, index)}
                      onPointerMove={onGripPointerMove}
                      onPointerUp={(e) => onGripPointerUp(e, item.label)}
                      onPointerCancel={() => setDrag(null)}
                      onKeyDown={(e) => onGripKeyDown(e, item.key, item.label, index)}
                      className={`-ml-1 flex h-5 w-4 flex-none touch-none items-center justify-center text-pn-gray-3 outline-none hover:text-pn-ink focus-visible:text-pn-ink focus-visible:ring-2 focus-visible:ring-pn-accent ${
                        drag ? "cursor-grabbing" : "cursor-grab"
                      }`}
                    >
                      <GripVertical size={14} />
                    </button>
                    <Checkbox
                      id={`${idPrefix}-${item.key}`}
                      checked={item.checked}
                      disabled={item.locked}
                      onCheckedChange={() => onToggle(item.key)}
                    />
                    {/* Sentence case here, unlike the app's default uppercase
                     * Label — the all-caps, letter-spaced style made labels
                     * long enough to wrap and was harder to scan as a list. */}
                    <Label htmlFor={`${idPrefix}-${item.key}`} className="flex-1 pl-0.5 text-[12.5px] font-normal tracking-normal text-pn-ink normal-case">
                      {item.label}
                    </Label>
                    {item.note && <span className="text-[10px] font-semibold whitespace-nowrap text-[#0a5c3c]">{item.note}</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-col items-start gap-1.5 border-t border-pn-rule pt-2">{footer}</div>
            <div aria-live="polite" className="sr-only">
              {announcement}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export const CHECKLIST_FOOTER_BUTTON = "cursor-pointer text-[11px] font-semibold text-pn-gray-2 hover:text-pn-ink";
