/** Prefix of the short member ID staff and members see (MBR-000123). */
export const MEMBER_NUMBER_PREFIX = "MBR";

/** The member's short, human-facing ID — `MBR-000123`, same shape as the
 * provider's `NMD-000123` (lib/providerNumber.ts). The uuid stays the
 * internal key and what URLs use. */
export function formatMemberNumber(n: number): string {
  return `${MEMBER_NUMBER_PREFIX}-${String(n).padStart(6, "0")}`;
}

/** Reads a typed member number back into its integer — accepts
 * "MBR-000123", "mbr-123", "000123" or "123"; null for anything else. */
export function parseMemberNumber(input: string): number | null {
  const m = /^(?:mbr-?)?0*(\d{1,9})$/i.exec(input.trim());
  return m ? Number(m[1]) : null;
}

/** Whole years between a date of birth and `now`, or null without one. */
export function ageFromDateOfBirth(dateOfBirth: Date | null | undefined, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}
