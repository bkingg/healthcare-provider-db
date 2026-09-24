"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Width limits (px) for every user-resizable panel/column. Keys are
 * namespaced ("col:" for the provider results table's columns) so one store
 * and one localStorage entry can back all of them. A key that's absent from
 * the saved widths means "use the layout's default" — that's what
 * double-click-to-reset removes a key back to. */
export const PANEL_LIMITS = {
  nav: { min: 200, max: 420 },
  filters: { min: 180, max: 480 },
  col: { min: 48, max: 800 },
} as const;

export type PanelKey = "nav" | "filters" | `col:${string}`;

function limitsFor(key: PanelKey) {
  return key.startsWith("col:") ? PANEL_LIMITS.col : PANEL_LIMITS[key as "nav" | "filters"];
}

export function clampWidth(key: PanelKey, px: number): number {
  const { min, max } = limitsFor(key);
  return Math.round(Math.min(max, Math.max(min, px)));
}

type Widths = Readonly<Partial<Record<PanelKey, number>>>;

const STORAGE_KEY = "pn-panel-widths";

// Module-level store backing useSyncExternalStore below — same shape as
// column-visibility.ts: getServerSnapshot is a fixed empty object so the
// server-rendered HTML (always default widths) never desyncs from hydration.
const NO_WIDTHS: Widths = {};
let widths: Widths = NO_WIDTHS;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return;
    const next: Partial<Record<PanelKey, number>> = {};
    for (const [k, v] of Object.entries(saved)) {
      const key = k as PanelKey;
      if ((key === "nav" || key === "filters" || key.startsWith("col:")) && typeof v === "number" && Number.isFinite(v)) {
        next[key] = clampWidth(key, v);
      }
    }
    widths = next;
  } catch {
    // Corrupt or blocked storage — keep the default widths.
  }
}

/** Written separately from set() so a drag (dozens of updates a second)
 * only touches localStorage once, when the pointer is released. */
export function persistPanelWidths() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // Storage full/blocked — resizing still works for this session.
  }
}

function emit(next: Widths) {
  widths = next;
  listeners.forEach((l) => l());
}

export function setPanelWidth(key: PanelKey, px: number) {
  ensureHydrated();
  const clamped = clampWidth(key, px);
  if (widths[key] === clamped) return;
  emit({ ...widths, [key]: clamped });
}

export function resetPanelWidths(keys: (key: PanelKey) => boolean) {
  ensureHydrated();
  const next = Object.fromEntries(Object.entries(widths).filter(([k]) => !keys(k as PanelKey)));
  emit(next);
  persistPanelWidths();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Widths {
  ensureHydrated();
  return widths;
}

function getServerSnapshot(): Widths {
  return NO_WIDTHS;
}

export function usePanelWidths() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resetColumnWidths = useCallback(() => resetPanelWidths((k) => k.startsWith("col:")), []);
  return { widths: current, resetColumnWidths };
}
