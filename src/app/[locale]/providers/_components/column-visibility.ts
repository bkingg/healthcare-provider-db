"use client";

import { useCallback, useSyncExternalStore } from "react";

// Checkbox and Name aren't in this list — they're always shown (row identity,
// not optional detail). Order here is display order for both the results
// table's columns and the Columns menu's checklist.
export const PROVIDER_COLUMNS = [
  { key: "providerId", labelKey: "columnProviderId", width: "88px" },
  { key: "type", labelKey: "columnType", width: "110px" },
  { key: "countryCity", labelKey: "columnCountryCity", width: "120px" },
  { key: "specialties", labelKey: "columnSpecialties", width: "minmax(120px,1.2fr)" },
  { key: "facility", labelKey: "columnFacility", width: "minmax(110px,1fr)" },
  { key: "network", labelKey: "columnNetwork", width: "92px" },
  { key: "status", labelKey: "columnStatus", width: "84px" },
  { key: "rating", labelKey: "columnRating", width: "62px" },
] as const;

export type ProviderColumnKey = (typeof PROVIDER_COLUMNS)[number]["key"];

const ALL_KEYS = PROVIDER_COLUMNS.map((c) => c.key);
const STORAGE_KEY = "pn-provider-columns";

// Module-level store backing useSyncExternalStore below — same shape as
// open-tabs-context.tsx (see its comments for why: avoids the
// "setState inside an effect" anti-pattern, and getServerSnapshot must stay
// a fixed reference so hydration doesn't desync from the server-rendered
// HTML, which always shows every column).
const ALL_VISIBLE: ProviderColumnKey[] = ALL_KEYS;
let visible: ProviderColumnKey[] = ALL_VISIBLE;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (Array.isArray(saved)) visible = ALL_KEYS.filter((k) => saved.includes(k));
    }
  } catch {
    // Corrupt or blocked storage — just keep the default (everything visible).
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
  } catch {
    // Storage full/blocked — toggling still works for this session.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ProviderColumnKey[] {
  ensureHydrated();
  return visible;
}

function getServerSnapshot(): ProviderColumnKey[] {
  return ALL_VISIBLE;
}

function setVisible(next: ProviderColumnKey[]) {
  visible = next;
  persist();
  listeners.forEach((l) => l());
}

/** Shared between the Columns menu (toggles) and the results table (reads,
 * to decide what to render) — module-level state rather than React context
 * so the two can live in different parts of the tree (the button sits in
 * the page header, the table below it) without prop-drilling through the
 * server-rendered page component between them. */
export function useVisibleColumns() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const visibleSet = new Set<ProviderColumnKey>(current);

  const toggleColumn = useCallback((key: ProviderColumnKey) => {
    ensureHydrated();
    setVisible(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  }, []);

  const resetColumns = useCallback(() => {
    ensureHydrated();
    setVisible(ALL_KEYS);
  }, []);

  return { visibleColumns: visibleSet, toggleColumn, resetColumns };
}
