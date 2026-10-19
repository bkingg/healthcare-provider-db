"use client";

import { useCallback, useSyncExternalStore } from "react";
import { REFERENCE_LIST_DEFS, type ReferenceListKey } from "@/lib/referenceListDefs";

const STORAGE_PREFIX = "pn-admin-columns-";
const EMPTY: string[] = [];

// Same module-level-store + useSyncExternalStore shape as the providers
// results table's useVisibleColumns (see providers/_components/
// column-visibility.ts) — lets the Columns toggle button (next to "Add
// value" in the page header) and the list table (rendered separately below
// it) share state without prop-drilling through the server-rendered admin
// page. Unlike PROVIDER_COLUMNS, the admin editor's extra columns differ per
// value list, so the store is keyed by ReferenceListKey rather than being a
// single fixed set.
type Store = { visible: string[]; hydrated: boolean };
const stores = new Map<ReferenceListKey, Store>();
const listeners = new Map<ReferenceListKey, Set<() => void>>();

// The list's own default columns (most lists: none), one stable array per
// list so the server snapshot never changes identity.
const defaultsCache = new Map<ReferenceListKey, string[]>();
function defaultsFor(listKey: ReferenceListKey): string[] {
  let d = defaultsCache.get(listKey);
  if (!d) {
    const def = REFERENCE_LIST_DEFS[listKey] as { defaultColumns?: string[] };
    d = def.defaultColumns ?? EMPTY;
    defaultsCache.set(listKey, d);
  }
  return d;
}

function getStore(listKey: ReferenceListKey): Store {
  let store = stores.get(listKey);
  if (!store) {
    store = { visible: defaultsFor(listKey), hydrated: false };
    stores.set(listKey, store);
  }
  return store;
}

function ensureHydrated(listKey: ReferenceListKey) {
  const store = getStore(listKey);
  if (store.hydrated) return;
  store.hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + listKey);
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (Array.isArray(saved)) store.visible = saved.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // Corrupt or blocked storage — just keep the list's default columns.
  }
}

function persist(listKey: ReferenceListKey) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + listKey, JSON.stringify(getStore(listKey).visible));
  } catch {
    // Storage full/blocked — toggling still works for this session.
  }
}

function notify(listKey: ReferenceListKey) {
  listeners.get(listKey)?.forEach((l) => l());
}

function subscribe(listKey: ReferenceListKey, listener: () => void) {
  let set = listeners.get(listKey);
  if (!set) {
    set = new Set();
    listeners.set(listKey, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}

/** Which of a value list's own form fields (see referenceListDefs.ts) are
 * currently shown as extra columns on its main table, plus a toggle to
 * add/remove one — e.g. checking "Name (FR)" for Specialties shows every
 * specialty's French name in the table without opening each item's edit
 * dialog. Selection persists per list (localStorage) across visits.
 * getServerSnapshot always returns "nothing extra" so hydration matches the
 * server-rendered table, which shows only the fixed columns. */
export function useExtraColumns(listKey: ReferenceListKey) {
  const current = useSyncExternalStore(
    useCallback((listener) => subscribe(listKey, listener), [listKey]),
    () => {
      ensureHydrated(listKey);
      return getStore(listKey).visible;
    },
    () => defaultsFor(listKey),
  );
  const visibleColumns = new Set(current);

  const toggleColumn = useCallback(
    (key: string) => {
      ensureHydrated(listKey);
      const store = getStore(listKey);
      store.visible = store.visible.includes(key) ? store.visible.filter((k) => k !== key) : [...store.visible, key];
      persist(listKey);
      notify(listKey);
    },
    [listKey],
  );

  const clearColumns = useCallback(() => {
    ensureHydrated(listKey);
    getStore(listKey).visible = [];
    persist(listKey);
    notify(listKey);
  }, [listKey]);

  return { visibleColumns, toggleColumn, clearColumns };
}
