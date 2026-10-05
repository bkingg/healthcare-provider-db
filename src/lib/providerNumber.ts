/** Prefix of the short provider ID staff see and type (NMD-000123). */
export const PROVIDER_NUMBER_PREFIX = "NMD";

/** The provider's short, human-facing ID — `NMD-000123`. The uuid stays the
 * internal key (and what URLs use); this is what appears in the UI,
 * reports and search. Keep in step with the SQL expression in
 * data/search.ts and prisma/sql/enable-search.sql. */
export function formatProviderNumber(n: number): string {
  return `${PROVIDER_NUMBER_PREFIX}-${String(n).padStart(6, "0")}`;
}

/** A typed provider ID → its number: "NMD-000012", "nmd12", "NMD 12" — and,
 * when `allowBare` (the case's "Tag by ID" box), a plain "12". Bare numbers
 * aren't accepted where they'd clash with other IDs (the Cases search reads
 * them as case numbers). Null if it isn't a provider ID. */
export function parseProviderNumber(raw: string, { allowBare = false }: { allowBare?: boolean } = {}): number | null {
  const m = new RegExp(`^\\s*(?:${PROVIDER_NUMBER_PREFIX}[\\s-]*)${allowBare ? "?" : ""}0*(\\d{1,9})\\s*$`, "i").exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}
