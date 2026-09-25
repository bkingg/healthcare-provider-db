/** The case's short, human-facing ID — `CAS-000123`, same shape as member
 * (MBR-) and provider (NMD-) numbers. */
export function formatCaseNumber(n: number): string {
  return `CAS-${String(n).padStart(6, "0")}`;
}
