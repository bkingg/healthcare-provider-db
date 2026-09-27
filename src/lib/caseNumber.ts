/** The case's short, human-facing ID — `CAS-000123`, same shape as member
 * (MBR-) and provider (NMD-) numbers. */
export function formatCaseNumber(n: number): string {
  return `CAS-${String(n).padStart(6, "0")}`;
}

/** Reads a typed case number back into its integer — accepts "CAS-000123",
 * "cas-123", "CAS123", "000123" or "123"; null for anything else. */
export function parseCaseNumber(input: string): number | null {
  const m = /^(?:cas-?)?0*(\d{1,9})$/i.exec(input.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}
