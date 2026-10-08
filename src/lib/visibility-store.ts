"use client";

import { useCallback, useSyncExternalStore } from "react";

/** A show/hide + reorder checklist persisted to localStorage — backs both
 * the results table's Columns menu and the Filters panel's filter chooser.
 * Module-level state read through useSyncExternalStore rather than React
 * context, so a menu and the thing it controls can live in different parts
 * of the tree (e.g. a button in the page header, the table below it)
 * without prop-drilling through the server-rendered page between them.
 * getServerSnapshot stays a fixed reference (default order, everything
 * visible) so the server-rendered HTML never desyncs from hydration — same
 * reasoning as open-tabs-context.tsx.
 *
 * `order` is null until the user first reorders something, so each caller
 * can keep its own default order until then (the Filters panel's default
 * differs between /providers and /map). */
type State<K> = { readonly order: readonly K[] | null; readonly hidden: readonly K[] };

/** Moves `key` to `toIndex` within `order` (clamped to the list's bounds). */
export function moveKey<K>(order: readonly K[], key: K, toIndex: number): K[] {
  const from = order.indexOf(key);
  if (from === -1) return [...order];
  const next = order.filter((k) => k !== key);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, key);
  return next;
}

/** `defaultHidden`: keys that start unchecked until the user changes them
 * (e.g. the case list's less-used columns). */
export function createVisibilityStore<K extends string>(storageKey: string, allKeys: readonly K[], defaultHidden: readonly K[] = []) {
  const DEFAULT: State<K> = { order: null, hidden: defaultHidden };
  let state: State<K> = DEFAULT;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const isKey = (k: unknown): k is K => allKeys.includes(k as K);

  function ensureHydrated() {
    if (hydrated) return;
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (Array.isArray(saved)) {
        // Original format: just the list of visible keys, no custom order.
        state = { order: null, hidden: allKeys.filter((k) => !saved.includes(k)) };
      } else if (saved && typeof saved === "object") {
        const { order, hidden } = saved as { order?: unknown; hidden?: unknown };
        const savedOrder = Array.isArray(order) ? [...new Set(order.filter(isKey))] : null;
        state = {
          // Keys added to the app since the order was saved go on the end.
          order: savedOrder ? [...savedOrder, ...allKeys.filter((k) => !savedOrder.includes(k))] : null,
          hidden: Array.isArray(hidden) ? allKeys.filter((k) => hidden.includes(k)) : [],
        };
      }
    } catch {
      // Corrupt or blocked storage — just keep the default.
    }
  }

  function setState(next: State<K>) {
    state = next;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage full/blocked — changes still apply for this session.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot() {
    ensureHydrated();
    return state;
  }

  function getServerSnapshot() {
    return DEFAULT;
  }

  /** `defaultOrder` must be a stable reference (a module-level constant). */
  return function useVisibility(defaultOrder: readonly K[] = allKeys) {
    const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const visible = new Set<K>(allKeys.filter((k) => !current.hidden.includes(k)));

    const toggle = useCallback((key: K) => {
      ensureHydrated();
      const hidden = state.hidden.includes(key) ? state.hidden.filter((k) => k !== key) : [...state.hidden, key];
      setState({ ...state, hidden });
    }, []);

    const move = useCallback(
      (key: K, toIndex: number) => {
        ensureHydrated();
        setState({ ...state, order: moveKey(state.order ?? defaultOrder, key, toIndex) });
      },
      [defaultOrder],
    );

    const reset = useCallback(() => {
      ensureHydrated();
      setState(DEFAULT);
    }, []);

    return {
      visible,
      /** Every key (hidden ones included) in display order. */
      order: current.order ?? defaultOrder,
      /** The user's saved order, or null while they're on the default. */
      customOrder: current.order,
      toggle,
      move,
      reset,
    };
  };
}
