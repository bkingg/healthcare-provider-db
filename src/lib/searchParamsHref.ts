import { DEFAULT_STATUSES } from "@/lib/validation/search";

/** Builds the href for toggling one value in/out of a multi-value query
 * param, preserving every other current param — used by the filter pills and
 * (for single values) pagination links. Resets `cursors` (keyset pagination
 * position — see src/lib/validation/search.ts) whenever a filter changes,
 * since a cursor only makes sense against the result set it was captured
 * from. */
export function toggleParamHref(
  basePath: string,
  currentParams: Record<string, string | string[] | undefined>,
  key: string,
  value: string,
): string {
  // The status filter defaults to Active when its param is absent (see
  // DEFAULT_STATUSES), so "currently selected" has to account for that — and
  // switching off the last selected status must be written down as an empty
  // `statuses=` (meaning "any status"), since simply dropping the param
  // would snap the filter back to Active.
  const isStatusKey = key === "statuses";
  const rawValues = Array.isArray(currentParams[key]) ? (currentParams[key] as string[]) : currentParams[key] ? [currentParams[key] as string] : [];
  const currentValues = isStatusKey && currentParams[key] === undefined ? [...DEFAULT_STATUSES] : rawValues;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams)) {
    if (v === undefined) continue;
    for (const single of Array.isArray(v) ? v : [v]) {
      if (k === key && (single === value || single === "")) continue; // handled below
      if (k === "cursors") continue; // reset on filter change
      params.append(k, single);
    }
  }
  // Statuses that were only implied by the default aren't in `params` yet.
  if (isStatusKey && currentParams[key] === undefined) {
    for (const v of currentValues) if (v !== value) params.append(key, v);
  }
  if (!currentValues.includes(value)) params.append(key, value);
  if (isStatusKey && params.getAll(key).length === 0) params.append(key, "");
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Builds an href with a single scalar param set/replaced, preserving every
 * other current param as-is. Also resets `cursors` unless the caller is
 * explicitly setting `cursors` itself (pagination links build the next/prev
 * cursor stack directly), since every other scalar this is used for (sort,
 * pageSize, ...) changes the result ordering/shape a cursor was captured
 * against. */
export function withParamHref(basePath: string, currentParams: Record<string, string | string[] | undefined>, key: string, value: string | number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams)) {
    if (v === undefined || k === key) continue;
    if (k === "cursors" && key !== "cursors") continue;
    for (const single of Array.isArray(v) ? v : [v]) params.append(k, single);
  }
  params.append(key, String(value));
  return `${basePath}?${params.toString()}`;
}

/** Keyset-pagination Next href: pushes the freshly computed boundary cursor
 * (from the last row of the current page — see nextCursorToken returned by
 * searchProviders) onto the `cursors` stack. */
export function nextCursorHref(
  basePath: string,
  currentParams: Record<string, string | string[] | undefined>,
  cursors: string[],
  nextCursorToken: string,
): string {
  return withParamHref(basePath, currentParams, "cursors", [...cursors, nextCursorToken].join("|"));
}

/** Keyset-pagination Previous href: drops the last boundary token and
 * replays the shallower query it represents, rather than computing a
 * reverse-direction query — so Previous costs the same as Next regardless of
 * how deep the cursor stack is. */
export function prevCursorHref(basePath: string, currentParams: Record<string, string | string[] | undefined>, cursors: string[]): string {
  return withParamHref(basePath, currentParams, "cursors", cursors.slice(0, -1).join("|"));
}

/** Href to the Map page showing the same search as the results list: every
 * current filter is carried over, but the list's keyset-pagination position
 * (`cursors`) and page size are dropped — the map isn't paginated, it plots
 * every match (up to its cap; see searchProvidersForMap). */
export function mapExportHref(currentParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams)) {
    if (v === undefined || k === "cursors" || k === "pageSize") continue;
    for (const single of Array.isArray(v) ? v : [v]) params.append(k, single);
  }
  const qs = params.toString();
  return qs ? `/map?${qs}` : "/map";
}
