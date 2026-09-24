"use client";

import { createVisibilityStore } from "@/lib/visibility-store";

// Every group in the Filters panel (search-filter-bar.tsx). Shared by
// /providers and /map, so hiding or reordering a group applies on both.
export const FILTER_GROUPS = [
  { key: "distance", labelKey: "distanceFromPoint" },
  { key: "providerType", labelKey: "providerType" },
  { key: "recordType", labelKey: "recordType" },
  { key: "country", labelKey: "country" },
  { key: "region", labelKey: "region" },
  { key: "status", labelKey: "status" },
  { key: "specialty", labelKey: "specialty" },
  { key: "capability", labelKey: "capability" },
  { key: "network", labelKey: "network" },
  { key: "locationQuality", labelKey: "locationQuality" },
  { key: "availability", labelKey: "availability" },
] as const;

export type FilterGroupKey = (typeof FILTER_GROUPS)[number]["key"];

const ALL_KEYS: FilterGroupKey[] = FILTER_GROUPS.map((g) => g.key);

/** Each page's order until the user reorders anything: distance-from-point
 * leads on the geospatial search screen (/map), where searching around a
 * location is the point of the page, and comes last on /providers, where
 * it's one filter among many. Once the user sets an order, both pages use
 * it. Module-level constants — useVisibleFilters needs stable references. */
export const MAP_FILTER_ORDER: readonly FilterGroupKey[] = ALL_KEYS;
export const PROVIDERS_FILTER_ORDER: readonly FilterGroupKey[] = [...ALL_KEYS.filter((k) => k !== "distance"), "distance"];

export function defaultFilterOrder(basePath: string): readonly FilterGroupKey[] {
  return basePath === "/map" ? MAP_FILTER_ORDER : PROVIDERS_FILTER_ORDER;
}

export const useVisibleFilters = createVisibilityStore<FilterGroupKey>("pn-search-filters", ALL_KEYS);
