"use client";

import { createVisibilityStore } from "@/lib/visibility-store";
import type { CaseSortKey } from "@/lib/caseListSort";

// The case list's columns, in default order. Every column sorts. Case # is
// `locked` (row identity): it can be moved but not hidden. `hidden` ones
// start unchecked in the Columns menu.
export const CASE_COLUMNS = [
  { key: "priority", width: "78px" },
  { key: "caseNumber", width: "88px", locked: true },
  { key: "type", width: "minmax(146px,2fr)" },
  { key: "patient", width: "minmax(140px,1.3fr)" },
  { key: "requestedBy", width: "minmax(130px,1fr)", hidden: true },
  { key: "memberId", width: "110px", hidden: true },
  { key: "status", width: "108px" },
  { key: "assigned", width: "minmax(110px,1fr)" },
  { key: "nextAction", width: "minmax(140px,1.4fr)" },
  { key: "due", width: "118px" },
  { key: "waiting", width: "96px", hidden: true },
  { key: "created", width: "112px" },
  { key: "channel", width: "108px", hidden: true },
  { key: "coverage", width: "120px", hidden: true },
  { key: "urgency", width: "130px", hidden: true },
  { key: "location", width: "minmax(130px,1fr)", hidden: true },
  { key: "phone", width: "140px", hidden: true },
] as const satisfies readonly { key: CaseSortKey; width: string; locked?: boolean; hidden?: boolean }[];

export type CaseColumnKey = (typeof CASE_COLUMNS)[number]["key"];

const LOCKED = new Set<CaseColumnKey>(CASE_COLUMNS.filter((c) => "locked" in c).map((c) => c.key));
export const isLockedCaseColumn = (k: CaseColumnKey) => LOCKED.has(k);
export const CASE_COLUMN_WIDTH = Object.fromEntries(CASE_COLUMNS.map((c) => [c.key, c.width])) as Record<CaseColumnKey, string>;

const useStore = createVisibilityStore<CaseColumnKey>(
  "pn-case-columns",
  CASE_COLUMNS.map((c) => c.key),
  CASE_COLUMNS.filter((c) => "hidden" in c).map((c) => c.key),
);

/** Shared by the Columns menu and the table. Saved in this browser. */
export function useCaseColumns() {
  const { visible, order, toggle, move, reset } = useStore();
  const shown = new Set<CaseColumnKey>([...visible, ...LOCKED]);
  return { shown, order, columns: order.filter((k) => shown.has(k)), toggle, move, reset };
}
