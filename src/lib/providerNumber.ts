/** Prefix of the short provider ID staff see and type (NMD-000123). */
export const PROVIDER_NUMBER_PREFIX = "NMD";

/** The provider's short, human-facing ID — `NMD-000123`. The uuid stays the
 * internal key (and what URLs use); this is what appears in the UI,
 * reports and search. Keep in step with the SQL expression in
 * data/search.ts and prisma/sql/enable-search.sql. */
export function formatProviderNumber(n: number): string {
  return `${PROVIDER_NUMBER_PREFIX}-${String(n).padStart(6, "0")}`;
}
