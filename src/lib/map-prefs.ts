"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Geospatial search: group nearby providers into numbered bubbles (the
 * default) or show every provider as its own pin. Remembered per browser,
 * like the other layout preferences; the server render always groups. */
const STORAGE_KEY = "pn-map-grouping";
let grouped = true;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "individual") grouped = false;
  } catch {
    // Blocked storage — keep grouping on.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMapGrouping(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      ensureHydrated();
      return grouped;
    },
    () => true,
  );
  const set = useCallback((next: boolean) => {
    grouped = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "grouped" : "individual");
    } catch {
      // Storage full/blocked — still applies for this session.
    }
    listeners.forEach((l) => l());
  }, []);
  return [value, set];
}
