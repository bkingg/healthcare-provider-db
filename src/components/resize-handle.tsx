"use client";

import { useRef } from "react";
import { persistPanelWidths, resetPanelWidths, setPanelWidth, type PanelKey } from "@/lib/panel-widths";

const KEYBOARD_STEP = 16;

/** Drag handle for a user-resizable panel or table column. Measures the
 * element it resizes at drag start rather than reading the stored width, so
 * it works from the layout's default (e.g. a `minmax(…, 1.6fr)` column that
 * has never been resized) just as well as from a saved one.
 *
 * - `measure="previous"`: panel mode — rendered as the flex sibling right
 *   after the panel (outside it, so the panel's own overflow scrolling
 *   doesn't carry the handle along with its content).
 * - `measure="parent"`: column mode — rendered inside a `relative` header
 *   cell, on its right edge.
 *
 * Double-click resets to the layout default; arrow keys resize by 16px
 * (48px with Shift) for keyboard users. */
export function ResizeHandle({
  panelKey,
  measure,
  label,
  className = "",
}: {
  panelKey: PanelKey;
  measure: "previous" | "parent";
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function targetWidth(): number {
    const handle = ref.current;
    if (!handle) return 0;
    // Panel mode renders the hit area inside a zero-width wrapper (see
    // below), so the panel is that wrapper's previous sibling.
    const target = measure === "parent" ? handle.parentElement : handle.parentElement?.previousElementSibling;
    return target?.getBoundingClientRect().width ?? 0;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: targetWidth() };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPanelWidth(panelKey, drag.current.startWidth + e.clientX - drag.current.startX);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persistPanelWidths();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    const step = (e.shiftKey ? 3 : 1) * KEYBOARD_STEP * (e.key === "ArrowLeft" ? -1 : 1);
    setPanelWidth(panelKey, targetWidth() + step);
    persistPanelWidths();
  }

  const hitArea = (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => {
        e.stopPropagation();
        resetPanelWidths((k) => k === panelKey);
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      className={`absolute top-0 bottom-0 z-[3] w-[7px] cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-[2px] after:w-[3px] after:bg-transparent hover:after:bg-pn-accent focus-visible:after:bg-pn-accent active:after:bg-pn-accent ${
        measure === "parent" ? "-right-1" : "-left-[5px]"
      }`}
    />
  );

  if (measure === "parent") return hitArea;
  return <div className={`relative w-0 flex-none ${className}`}>{hitArea}</div>;
}
