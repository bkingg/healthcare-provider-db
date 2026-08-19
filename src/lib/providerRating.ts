/** Compact text for a provider's two star ratings — "Q 4 · A 3" — or null
 * when neither is set. Used where there's room for a label rather than
 * stars (search results, the map popup). */
export function formatProviderRating(quality: number | null, access: number | null): string | null {
  const parts = [quality ? `Q ${quality}` : null, access ? `A ${access}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Sort key for the results table's Rating column: the two ratings added
 * together (null when neither is set). Keep in step with the SQL in
 * data/search.ts. */
export function providerRatingSortValue(quality: number | null, access: number | null): number | null {
  const sum = (quality ?? 0) + (access ?? 0);
  return sum === 0 ? null : sum;
}
