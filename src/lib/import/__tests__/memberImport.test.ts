import { describe, expect, it } from "vitest";
import { checkMemberRows, normalizeDate, normalizeHeader, summarize, type MemberImportRefs, type RawMemberRow } from "../memberImport";

const ORG = "11111111-1111-4111-8111-111111111111";
const SPOUSE = "22222222-2222-4222-8222-222222222222";
const CHILD = "33333333-3333-4333-8333-333333333333";
const SN = "44444444-4444-4444-8444-444444444444";
const EXISTING_PRIMARY = "55555555-5555-4555-8555-555555555555";

function refs(overrides: Partial<MemberImportRefs> = {}): MemberImportRefs {
  return {
    organizationsByCode: new Map([["ACME", ORG]]),
    relationshipsByCode: new Map([["SPOUSE", SPOUSE], ["CHILD", CHILD]]),
    countriesByIso2: new Map([["SN", SN]]),
    existingEmails: new Set(["taken@example.com"]),
    existingPeople: new Map([["jean|diop|1979-11-30", 4]]),
    existingPrimariesByNumber: new Map([[1, EXISTING_PRIMARY]]),
    ...overrides,
  };
}

const primary: RawMemberRow = { household_id: "H1", first_name: "Awa", last_name: "Sow", date_of_birth: "12/04/1986", sex: "F", email: "Awa@Example.com", country_code: "sn", organization_code: "acme", coverage_start: "01/01/2026", coverage_end: "31/12/2026" };
const spouse: RawMemberRow = { household_id: "H1", relationship: "spouse", first_name: "Moussa", last_name: "Sow", date_of_birth: "1983-09-02", sex: "M" };
const child: RawMemberRow = { household_id: "H1", relationship: "CHILD", first_name: "Fatou", last_name: "Sow", date_of_birth: "21/06/2015" };

describe("helpers", () => {
  it("normalizes headers and day-first dates", () => {
    expect(normalizeHeader(" First Name ")).toBe("first_name");
    expect(normalizeHeader("date-of-birth")).toBe("date_of_birth");
    expect(normalizeDate("31/01/2026")).toBe("2026-01-31");
    expect(normalizeDate("1-2-2026")).toBe("2026-02-01");
    expect(normalizeDate("2026-01-31")).toBe("2026-01-31");
    expect(normalizeDate("Jan 31 2026")).toBe("Jan 31 2026");
  });
});

describe("checkMemberRows", () => {
  it("accepts a household, resolving codes and normalizing values", () => {
    const rows = checkMemberRows([primary, spouse, child], refs());
    expect(rows.map((r) => r.errors)).toEqual([[], [], []]);
    expect(rows[0]).toMatchObject({ isPrimary: true, householdId: "H1" });
    expect(rows[0].input).toMatchObject({ email: "awa@example.com", sex: "FEMALE", organizationId: ORG, countryId: SN });
    expect(rows[0].input?.dateOfBirth?.toISOString().slice(0, 10)).toBe("1986-04-12");
    expect(rows[1].input).toMatchObject({ relationshipId: SPOUSE, sex: "MALE" });
    expect(rows[2].rowNumber).toBe(4);
    expect(summarize(rows)).toEqual({ total: 3, ready: 3, withErrors: 0, households: 1 });
  });

  it("reports unknown codes and form-rule failures per row", () => {
    const [row] = checkMemberRows([{ ...primary, organization_code: "NOPE", country_code: "XX", email: "bad", first_name: "" }], refs());
    expect(row.errors.join(" ")).toMatch(/organization_code "NOPE"/);
    expect(row.errors.join(" ")).toMatch(/country_code "XX"/);
    expect(row.errors.join(" ")).toMatch(/email/);
    expect(row.errors.join(" ")).toMatch(/firstName/);
  });

  it("rejects an unknown relationship, a missing household_id and a household without a primary", () => {
    const rows = checkMemberRows([{ ...spouse, relationship: "cousin" }, { ...primary, household_id: "" }, { ...child, household_id: "H9" }], refs());
    expect(rows[0].errors.join(" ")).toMatch(/Unknown relationship "cousin"/);
    expect(rows[1].errors.join(" ")).toMatch(/household_id is required/);
    expect(rows[2].errors.join(" ")).toMatch(/H9 has no primary member row/);
  });

  it("allows only one primary per household", () => {
    const rows = checkMemberRows([primary, { ...primary, email: "other@example.com", first_name: "Bineta" }], refs());
    for (const r of rows) expect(r.errors.join(" ")).toMatch(/2 primary member rows/);
  });

  it("flags emails used twice in the file or already taken", () => {
    const rows = checkMemberRows([primary, { ...spouse, email: "awa@example.com" }, { household_id: "H2", first_name: "X", last_name: "Y", email: "taken@example.com" }], refs());
    expect(rows[0].errors.join(" ")).toMatch(/appears on rows 2, 3/);
    expect(rows[2].errors.join(" ")).toMatch(/already used/);
  });

  it("flags people who are already members, so a re-upload doesn't duplicate them", () => {
    const [row] = checkMemberRows([{ household_id: "H3", first_name: "Jean", last_name: "Diop", date_of_birth: "30/11/1979" }], refs());
    expect(row.errors.join(" ")).toMatch(/Already a member \(MBR-000004\)/);
  });

  it("holds back dependents when their primary row has errors", () => {
    const rows = checkMemberRows([{ ...primary, first_name: "" }, spouse, child], refs());
    expect(rows[1].errors).toEqual(["Held back: the primary member on row 2 has errors."]);
    expect(summarize(rows).ready).toBe(0);
  });

  it("adds dependents to an existing member when household_id is their member number", () => {
    const rows = checkMemberRows([{ ...child, household_id: "MBR-000001" }], refs());
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].existingPrimaryId).toBe(EXISTING_PRIMARY);
    const [bad] = checkMemberRows([{ ...primary, household_id: "MBR-000001" }], refs());
    expect(bad.errors.join(" ")).toMatch(/must be dependents/);
  });
});
