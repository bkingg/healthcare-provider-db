"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";

export type OpenTab = { id: string; name: string };

const STORAGE_KEY = "pn-open-provider-tabs";

// Module-level store backing useSyncExternalStore below — the textbook shape
// for subscribing to an external system (localStorage) without the
// "setState inside an effect" anti-pattern that a plain useState+useEffect
// hydration would be. `tabs` only ever gets mutated by a browser event
// handler/effect (openTab/closeTab/closeAllTabs/setTabs), never during SSR,
// so the module being re-evaluated per request on the server never leaks
// state between users.
const EMPTY: OpenTab[] = [];
let tabs: OpenTab[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

// Hydration is gated behind this, called both by getSnapshot() (React's own
// read) and by openTab/closeTab/closeAllTabs (which can run from an effect
// in a *different* component — ProviderHeader — before React has ever
// called getSnapshot). Without a shared gate, whichever ran first would read
// the pre-hydration `[]` and its subsequent write would clobber the other's
// data in localStorage. `getServerSnapshot` deliberately never calls this —
// it must always return the same fixed `EMPTY` reference, since that's what
// the server actually rendered; hydrating it too would desync the client's
// hydration pass from the server HTML and trigger a hydration-mismatch
// regeneration.
function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) tabs = JSON.parse(raw) as OpenTab[];
  } catch {
    // Corrupt or blocked storage — just start with no tabs open.
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // Storage full/blocked — tabs still work for this session, just won't persist.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): OpenTab[] {
  ensureHydrated();
  return tabs;
}

function getServerSnapshot(): OpenTab[] {
  return EMPTY;
}

function setTabs(next: OpenTab[]) {
  tabs = next;
  persist();
  listeners.forEach((l) => l());
}

type OpenTabsContextValue = {
  tabs: OpenTab[];
  openTab: (tab: OpenTab) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
};

const OpenTabsContext = createContext<OpenTabsContextValue | null>(null);

/** Tracks which provider records the user currently has "open" (visited in
 * this browser), so the header can show them as closable tabs and let the
 * user jump back to one without re-searching. Lives above AppShell's header
 * so the tab strip (next to search) and the close button (top-right) can
 * share the same state. */
export function OpenTabsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const openTabs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const openTab = useCallback((tab: OpenTab) => {
    ensureHydrated();
    const existing = tabs.find((t) => t.id === tab.id);
    if (!existing) {
      setTabs([...tabs, tab]);
    } else if (existing.name !== tab.name) {
      setTabs(tabs.map((t) => (t.id === tab.id ? { ...t, name: tab.name } : t)));
    }
  }, []);

  // Closing the tab that's currently on screen also navigates away from it —
  // otherwise "closing" a record would leave it open in the main pane while
  // no longer listed as open, which isn't what "close" means here.
  const closeTab = useCallback(
    (id: string) => {
      ensureHydrated();
      const next = tabs.filter((t) => t.id !== id);
      setTabs(next);
      if (pathname === `/providers/${id}`) {
        const fallback = next[next.length - 1];
        router.push(fallback ? `/providers/${fallback.id}` : "/providers");
      }
    },
    [pathname, router],
  );

  const closeAllTabs = useCallback(() => {
    ensureHydrated();
    const wasOpen = tabs.some((t) => pathname === `/providers/${t.id}`);
    setTabs([]);
    if (wasOpen) router.push("/providers");
  }, [pathname, router]);

  return <OpenTabsContext.Provider value={{ tabs: openTabs, openTab, closeTab, closeAllTabs }}>{children}</OpenTabsContext.Provider>;
}

export function useOpenTabs() {
  const ctx = useContext(OpenTabsContext);
  if (!ctx) throw new Error("useOpenTabs must be used within OpenTabsProvider");
  return ctx;
}
