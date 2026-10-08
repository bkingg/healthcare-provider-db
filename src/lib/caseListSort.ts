/** Sorting the staff case list by any column. The default, "priority", is
 * the triage order: red → yellow → green, then the nearest response
 * deadline, then the longest-waiting. */
export const CASE_SORT_KEYS = [
  "priority",
  "caseNumber",
  "type",
  "patient",
  "requestedBy",
  "memberId",
  "status",
  "assigned",
  "nextAction",
  "due",
  "waiting",
  "created",
  "channel",
  "coverage",
  "urgency",
  "location",
  "phone",
] as const;
export type CaseSortKey = (typeof CASE_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export type CaseSort = { key: CaseSortKey; dir: SortDir };

/** First click on a header: newest first for "created", longest-waiting
 * first for "waiting"; A→Z / lowest first for the rest. */
export function defaultDir(key: CaseSortKey): SortDir {
  return key === "created" ? "desc" : "asc";
}

export function parseCaseSort(sort: unknown, dir: unknown): CaseSort {
  const key = CASE_SORT_KEYS.includes(sort as CaseSortKey) ? (sort as CaseSortKey) : "priority";
  return { key, dir: dir === "asc" || dir === "desc" ? dir : defaultDir(key) };
}

/** The direction a header click asks for: flips the current column,
 * otherwise starts the new one in its natural direction. */
export function nextSort(current: CaseSort, key: CaseSortKey): CaseSort {
  return current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) };
}

export type SortValue = string | number | null | undefined;

/** A stable sort by `value`; empty values (no assignee, no deadline…) go
 * last whichever way you sort. Text compares case- and accent-blind, with
 * numbers inside it in number order. */
export function sortByValue<T>(items: readonly T[], value: (item: T) => SortValue | SortValue[], dir: SortDir, locale = "fr"): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const sign = dir === "asc" ? 1 : -1;
  const one = (a: SortValue, b: SortValue) => {
    const ae = a === null || a === undefined || a === "";
    const be = b === null || b === undefined || b === "";
    if (ae || be) return ae && be ? 0 : ae ? 1 : -1;
    return sign * (typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b)));
  };
  return items
    .map((item, i) => ({ item, i, v: value(item) }))
    .sort((x, y) => {
      const xs = Array.isArray(x.v) ? x.v : [x.v];
      const ys = Array.isArray(y.v) ? y.v : [y.v];
      for (let k = 0; k < Math.max(xs.length, ys.length); k++) {
        const c = one(xs[k], ys[k]);
        if (c) return c;
      }
      return x.i - y.i;
    })
    .map((x) => x.item);
}
