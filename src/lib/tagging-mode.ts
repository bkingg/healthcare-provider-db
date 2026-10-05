"use client";

import { useSyncExternalStore } from "react";

/** "Tagging mode": staff came to Provider search from a case to tag the
 * providers the member is using. Remembered for this browser tab
 * (sessionStorage) while they search, filter and open profiles — Provider
 * search rebuilds its URL on every filter change, so a URL flag would be
 * lost. "Back to case" ends it. */
export type TaggingState = { caseId: string; caseNumber: number; patient: string; taggedIds: string[] };

const STORAGE_KEY = "pn-tagging-case";
let state: TaggingState | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as TaggingState;
  } catch {
    // Blocked storage or bad JSON — no tagging mode.
  }
}

function write(next: TaggingState | null) {
  state = next;
  try {
    if (next) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked — still works until the tab reloads.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTaggingMode(): TaggingState | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureHydrated();
      return state;
    },
    () => null,
  );
}

export function startTagging(next: TaggingState) {
  write(next);
}

export function markTagged(providerId: string) {
  if (state && !state.taggedIds.includes(providerId)) write({ ...state, taggedIds: [...state.taggedIds, providerId] });
}

export function stopTagging() {
  write(null);
}
