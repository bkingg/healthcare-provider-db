import { createMemberSchema, type MemberInput } from "@/lib/validation/members";
import { parseMemberNumber } from "@/lib/memberNumber";

/** Bulk member import (MVP step 1.1). Pure functions only — the file is read
 * and the reference lookups loaded in src/data/memberImport.ts; everything
 * here is deterministic so it can be unit-tested row by row. */

/** Template columns, in order. Header matching is case-insensitive and
 * treats spaces and underscores alike, so "First Name" matches first_name. */
export const MEMBER_IMPORT_COLUMNS = [
  "household_id",
  "relationship",
  "first_name",
  "last_name",
  "date_of_birth",
  "sex",
  "email",
  "phone",
  "preferred_language",
  "country_code",
  "city",
  "organization_code",
  "plan_name",
  "policy_number",
  "coverage_start",
  "coverage_end",
] as const;

export type MemberImportColumn = (typeof MEMBER_IMPORT_COLUMNS)[number];
export type RawMemberRow = Partial<Record<MemberImportColumn, string>>;

export const MAX_IMPORT_ROWS = 2000;

/** Reference data the rows are checked against, loaded once per upload. */
export type MemberImportRefs = {
  organizationsByCode: Map<string, string>;
  relationshipsByCode: Map<string, string>;
  countriesByIso2: Map<string, string>;
  /** Emails already used by members (lowercased). */
  existingEmails: Set<string>;
  /** "firstname|lastname|yyyy-mm-dd" (lowercased) → member number, for
   * spotting people who are already members. */
  existingPeople: Map<string, number>;
  /** Existing primary members by member number → id, so a household_id of
   * "MBR-000123" adds dependents to that household. */
  existingPrimariesByNumber: Map<number, string>;
};

export type CheckedRow = {
  /** Spreadsheet row number (header is row 1). */
  rowNumber: number;
  raw: RawMemberRow;
  householdId: string;
  isPrimary: boolean;
  /** Set when the household is an existing member's (household_id was a
   * member number). */
  existingPrimaryId?: string;
  input?: MemberInput;
  errors: string[];
};

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** "2026-01-31", "31/01/2026" or "31-01-2026" → "2026-01-31"; anything else
 * is returned unchanged so the schema reports it. Day-first on purpose —
 * that's how dates are written in Senegal and France; month-first US dates
 * would be misread, so they aren't guessed at. */
export function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return v;
}

function normalizeSex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toUpperCase();
  if (["F", "FEMALE", "FEMME"].includes(v)) return "FEMALE";
  if (["M", "MALE", "H", "HOMME"].includes(v)) return "MALE";
  return v;
}

export function personKey(firstName: string, lastName: string, dateOfBirth: string | undefined): string {
  return [firstName, lastName, dateOfBirth ?? ""].map((s) => s.trim().toLowerCase()).join("|");
}

const PRIMARY_WORDS = new Set(["", "primary", "principal", "self"]);

/** Checks every row against the member form's rules plus the cross-row
 * rules only an import has: one primary per household, no email used twice,
 * codes that exist, and people who are already members. A household whose
 * primary row has errors blocks its dependents too, so a household is never
 * half-imported. */
export function checkMemberRows(rows: RawMemberRow[], refs: MemberImportRefs): CheckedRow[] {
  const checked: CheckedRow[] = rows.map((raw, i) => {
    const errors: string[] = [];
    const householdId = raw.household_id?.trim() ?? "";
    const relationship = raw.relationship?.trim() ?? "";
    const isPrimary = PRIMARY_WORDS.has(relationship.toLowerCase());
    if (!householdId) errors.push("household_id is required (use the same value for a primary member and their dependents).");

    let relationshipId: string | undefined;
    if (!isPrimary) {
      relationshipId = refs.relationshipsByCode.get(relationship.toUpperCase());
      if (!relationshipId) errors.push(`Unknown relationship "${relationship}". Use a code from the Codes sheet, or leave it blank for the primary member.`);
    }
    let organizationId: string | undefined;
    if (raw.organization_code) {
      organizationId = refs.organizationsByCode.get(raw.organization_code.trim().toUpperCase());
      if (!organizationId) errors.push(`Unknown organization_code "${raw.organization_code}".`);
    }
    let countryId: string | undefined;
    if (raw.country_code) {
      countryId = refs.countriesByIso2.get(raw.country_code.trim().toUpperCase());
      if (!countryId) errors.push(`Unknown country_code "${raw.country_code}" (use a two-letter code such as SN).`);
    }

    const language = raw.preferred_language?.trim().toLowerCase();
    const parsed = createMemberSchema.safeParse({
      firstName: raw.first_name ?? "",
      lastName: raw.last_name ?? "",
      dateOfBirth: normalizeDate(raw.date_of_birth),
      sex: normalizeSex(raw.sex),
      email: raw.email,
      phone: raw.phone,
      preferredLanguage: language || undefined,
      city: raw.city,
      planName: raw.plan_name,
      policyNumber: raw.policy_number,
      coverageStart: normalizeDate(raw.coverage_start),
      coverageEnd: normalizeDate(raw.coverage_end),
    });
    let input: MemberInput | undefined;
    if (parsed.success) {
      input = { ...parsed.data, relationshipId, organizationId, countryId };
    } else {
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        for (const message of messages ?? []) errors.push(`${field}: ${message}`);
      }
    }
    if (input?.email && refs.existingEmails.has(input.email)) errors.push(`Email ${input.email} is already used by another member.`);
    if (input) {
      const existing = refs.existingPeople.get(personKey(input.firstName, input.lastName, normalizeDate(raw.date_of_birth)));
      if (existing !== undefined) errors.push(`Already a member (MBR-${String(existing).padStart(6, "0")}) — same name and date of birth.`);
    }
    return { rowNumber: i + 2, raw, householdId, isPrimary, input, errors };
  });

  // Email used twice within the file.
  const byEmail = new Map<string, CheckedRow[]>();
  for (const row of checked) {
    const email = row.input?.email;
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), row]);
  }
  for (const [email, dupes] of byEmail) {
    if (dupes.length > 1) {
      for (const row of dupes) row.errors.push(`Email ${email} appears on rows ${dupes.map((d) => d.rowNumber).join(", ")}.`);
    }
  }

  // Households: exactly one primary row, unless household_id is an existing
  // member's number (then every row is a dependent of that member).
  const byHousehold = new Map<string, CheckedRow[]>();
  for (const row of checked) if (row.householdId) byHousehold.set(row.householdId, [...(byHousehold.get(row.householdId) ?? []), row]);
  for (const [householdId, members] of byHousehold) {
    const existingNumber = parseMemberNumber(householdId);
    const existingPrimaryId = existingNumber !== null ? refs.existingPrimariesByNumber.get(existingNumber) : undefined;
    const primaries = members.filter((m) => m.isPrimary);
    if (existingPrimaryId) {
      for (const row of members) {
        row.existingPrimaryId = existingPrimaryId;
        if (row.isPrimary) row.errors.push(`Household ${householdId} is an existing member, so rows here must be dependents (fill in relationship).`);
      }
      continue;
    }
    if (primaries.length === 0) {
      for (const row of members) row.errors.push(`Household ${householdId} has no primary member row (relationship left blank).`);
    } else if (primaries.length > 1) {
      for (const row of primaries) row.errors.push(`Household ${householdId} has ${primaries.length} primary member rows; only one is allowed.`);
    }
  }

  // A household with a broken primary row isn't half-imported.
  for (const members of byHousehold.values()) {
    const primary = members.find((m) => m.isPrimary);
    if (primary && primary.errors.length > 0) {
      for (const row of members) {
        if (!row.isPrimary && row.errors.length === 0) row.errors.push(`Held back: the primary member on row ${primary.rowNumber} has errors.`);
      }
    }
  }
  return checked;
}

export function summarize(rows: CheckedRow[]) {
  const ready = rows.filter((r) => r.errors.length === 0);
  return {
    total: rows.length,
    ready: ready.length,
    withErrors: rows.length - ready.length,
    households: new Set(ready.filter((r) => r.isPrimary).map((r) => r.householdId)).size,
  };
}
