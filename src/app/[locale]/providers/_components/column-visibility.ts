"use client";

import { createVisibilityStore } from "@/lib/visibility-store";

// The results table's columns, in default display order (after the
// always-first row checkbox). Name is `locked`: it can be moved but not
// hidden (row identity, not optional detail). The Columns menu lists them in
// the user's order, which the table follows.
export const PROVIDER_COLUMNS = [
  { key: "providerId", labelKey: "columnProviderId", width: "88px" },
  { key: "name", labelKey: "columnName", width: "minmax(160px,1.6fr)", locked: true },
  { key: "type", labelKey: "columnType", width: "110px" },
  { key: "countryCity", labelKey: "columnCountryCity", width: "120px" },
  { key: "specialties", labelKey: "columnSpecialties", width: "minmax(120px,1.2fr)" },
  { key: "facility", labelKey: "columnFacility", width: "minmax(110px,1fr)" },
  { key: "network", labelKey: "columnNetwork", width: "92px" },
  { key: "status", labelKey: "columnStatus", width: "84px" },
  { key: "rating", labelKey: "columnRating", width: "62px" },
] as const;

export type ProviderColumnKey = (typeof PROVIDER_COLUMNS)[number]["key"];

const COLUMN_WIDTH = Object.fromEntries(PROVIDER_COLUMNS.map((c) => [c.key, c.width])) as Record<ProviderColumnKey, string>;
const LOCKED: ReadonlySet<ProviderColumnKey> = new Set(PROVIDER_COLUMNS.filter((c) => "locked" in c && c.locked).map((c) => c.key));

export function isLockedColumn(key: ProviderColumnKey): boolean {
  return LOCKED.has(key);
}

const useColumnVisibility = createVisibilityStore<ProviderColumnKey>(
  "pn-provider-columns",
  PROVIDER_COLUMNS.map((c) => c.key),
);

/** Shared between the Columns menu (toggles/reorders) and the results table
 * (reads, to decide what to render and in which order). The server render
 * always shows every column in the default order. */
export function useVisibleColumns() {
  const { visible, order, toggle, move, reset } = useColumnVisibility();
  // Locked columns count as visible whatever storage says — e.g. a saved
  // list from before Name was part of this list.
  const visibleColumns = new Set<ProviderColumnKey>([...visible, ...LOCKED]);
  return {
    visibleColumns,
    /** Every column, hidden ones included, in display order. */
    columnOrder: order,
    /** Just the columns to render, in display order. */
    orderedVisibleColumns: order.filter((k) => visibleColumns.has(k)),
    toggleColumn: toggle,
    moveColumn: move,
    resetColumns: reset,
  };
}

const CHECKBOX_COL = "28px";
// px-5 on the results table's header and every row.
const ROW_PADDING_X = 40;
const MIN_TABLE_WIDTH = 900;

/** Grid tracks for the results table: the row checkbox, then `columns` in
 * the order given. A column the user has resized (saved as `col:<key>` in
 * lib/panel-widths.ts) gets its fixed px width, the rest keep their default
 * track. Also returns the table's minimum width: the sum of every track's
 * fixed or `minmax()` minimum, so widening columns past the viewport scrolls
 * the table sideways instead of squeezing the flexible columns below their
 * minimums. */
export function buildGridTemplate(
  columns: readonly ProviderColumnKey[],
  widths: Readonly<Partial<Record<`col:${string}`, number>>>,
): { template: string; minWidth: number } {
  const tracks = [CHECKBOX_COL];
  let minWidth = ROW_PADDING_X + parseInt(CHECKBOX_COL, 10);
  for (const key of columns) {
    const width = COLUMN_WIDTH[key];
    const saved = widths[`col:${key}`];
    tracks.push(saved !== undefined ? `${saved}px` : width);
    minWidth += saved ?? parseInt(width.replace(/^minmax\(/, ""), 10);
  }
  return { template: tracks.join(" "), minWidth: Math.max(MIN_TABLE_WIDTH, minWidth) };
}
