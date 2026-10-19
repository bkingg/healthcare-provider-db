import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { cellText } from "./sheetFile";
import { AuditAction } from "@/lib/enums";
import {
  MAX_IMPORT_ROWS,
  MEMBER_IMPORT_COLUMNS,
  normalizeHeader,
  personKey,
  type CheckedRow,
  type MemberImportColumn,
  type MemberImportRefs,
  type RawMemberRow,
} from "@/lib/import/memberImport";

export type ReadResult = { rows: RawMemberRow[]; fileErrors: string[] };

const KNOWN = new Set<string>(MEMBER_IMPORT_COLUMNS);

function toRow(record: Record<string, string>): RawMemberRow {
  const row: RawMemberRow = {};
  for (const [header, value] of Object.entries(record)) {
    const key = normalizeHeader(header);
    const v = value?.trim();
    if (KNOWN.has(key) && v) row[key as MemberImportColumn] = v;
  }
  return row;
}

function checkHeaders(headers: string[]): string[] {
  const normalized = headers.map(normalizeHeader);
  const missing = ["household_id", "first_name", "last_name"].filter((h) => !normalized.includes(h));
  return missing.length ? [`Missing required column(s): ${missing.join(", ")}. Start from the template so the headers match.`] : [];
}

const DATE_COLUMNS = new Set(["date_of_birth", "coverage_start", "coverage_end"]);

/** A date typed or pasted into a text-formatted Excel cell (the template
 * formats date columns as text, so Excel doesn't rewrite what staff type)
 * is stored as Excel's day number — e.g. 32947 for 1990-03-15 — and comes
 * back as a plain number, not a Date. Day 0 is 1899-12-30 in Excel's
 * (1900-leap-year-quirk-compatible) calendar; the range check keeps
 * ordinary numbers from being read as dates. */
export function excelSerialToIsoDate(value: string): string {
  if (!/^\d{4,5}(\.\d+)?$/.test(value)) return value;
  const serial = Math.floor(Number(value));
  if (serial < 1 || serial > 73050) return value; // up to 2099-12-31
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

/** Reads the uploaded file into raw rows — CSV, or the first sheet of an
 * Excel workbook (the "Members" sheet in the template). Never throws for a
 * bad file: problems come back as fileErrors for the uploader to see. */
export async function readMemberFile(file: File): Promise<ReadResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: "greedy" });
    const fileErrors = [...checkHeaders(parsed.meta.fields ?? []), ...parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`)];
    return { rows: parsed.data.map(toRow), fileErrors };
  }
  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      return { rows: [], fileErrors: ["This Excel file couldn't be read. Save it as .xlsx (or CSV) and try again."] };
    }
    const sheet = workbook.getWorksheet("Members") ?? workbook.worksheets[0];
    if (!sheet) return { rows: [], fileErrors: ["The workbook has no sheets."] };
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = cellText(cell.value)));
    const rows: RawMemberRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const header = headers[col];
        if (!header) return;
        const text = cellText(cell.value);
        record[header] = DATE_COLUMNS.has(normalizeHeader(header)) && typeof cell.value === "number" ? excelSerialToIsoDate(text) : text;
      });
      if (Object.values(record).some((v) => v.trim())) rows.push(toRow(record));
    });
    return { rows, fileErrors: checkHeaders(headers.filter(Boolean)) };
  }
  return { rows: [], fileErrors: ["Upload a .xlsx or .csv file."] };
}

export function tooManyRows(rows: RawMemberRow[]): string | null {
  return rows.length > MAX_IMPORT_ROWS ? `The file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS} per upload. Split it into smaller files.` : null;
}

export async function loadImportRefs(): Promise<MemberImportRefs> {
  const [organizations, relationships, countries, members] = await Promise.all([
    prisma.organizationRef.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
    prisma.memberRelationshipRef.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
    prisma.countryRef.findMany({ where: { isActive: true }, select: { id: true, iso2: true } }),
    prisma.member.findMany({ select: { id: true, memberNumber: true, firstName: true, lastName: true, dateOfBirth: true, email: true, primaryMemberId: true, status: true } }),
  ]);
  return {
    organizationsByCode: new Map(organizations.map((o) => [o.code.toUpperCase(), o.id])),
    relationshipsByCode: new Map(relationships.map((r) => [r.code.toUpperCase(), r.id])),
    countriesByIso2: new Map(countries.map((c) => [c.iso2.trim().toUpperCase(), c.id])),
    existingEmails: new Set(members.flatMap((m) => (m.email ? [m.email] : []))),
    existingPeople: new Map(members.map((m) => [personKey(m.firstName, m.lastName, m.dateOfBirth?.toISOString().slice(0, 10)), m.memberNumber])),
    existingPrimariesByNumber: new Map(members.filter((m) => !m.primaryMemberId && m.status === "ACTIVE").map((m) => [m.memberNumber, m.id])),
  };
}

/** Saves the ready rows in one transaction — all of them or none — primary
 * members first so dependents can point at them. Each new member gets a
 * CREATE audit row naming the file it came from. Rows with errors are
 * never passed in (the caller filters them). */
export async function commitMemberImport(rows: CheckedRow[], fileName: string, actorId: string) {
  const ready = rows.filter((r) => r.errors.length === 0 && r.input);
  const reason = `Bulk import: ${fileName}`;
  return prisma.$transaction(
    async (tx) => {
      const primaryIdByHousehold = new Map<string, string>();
      let created = 0;
      const ordered = [...ready.filter((r) => r.isPrimary && !r.existingPrimaryId), ...ready.filter((r) => !r.isPrimary)];
      for (const row of ordered) {
        const input = row.input!;
        const primaryMemberId = row.isPrimary ? null : (row.existingPrimaryId ?? primaryIdByHousehold.get(row.householdId));
        if (!row.isPrimary && !primaryMemberId) throw new Error(`Row ${row.rowNumber}: its primary member wasn't imported.`);
        const member = await tx.member.create({
          data: {
            signupSource: "IMPORT",
            firstName: input.firstName,
            lastName: input.lastName,
            dateOfBirth: input.dateOfBirth ?? null,
            sex: input.sex,
            email: input.email ?? null,
            phone: input.phone ?? null,
            preferredLanguage: input.preferredLanguage,
            countryId: input.countryId ?? null,
            city: input.city ?? null,
            primaryMemberId,
            relationshipId: row.isPrimary ? null : (input.relationshipId ?? null),
            organizationId: input.organizationId ?? null,
            planName: input.planName ?? null,
            policyNumber: input.policyNumber ?? null,
            coverageStart: input.coverageStart ?? null,
            coverageEnd: input.coverageEnd ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        if (row.isPrimary) primaryIdByHousehold.set(row.householdId, member.id);
        await tx.auditLog.create({ data: { entityType: "Member", entityId: member.id, action: AuditAction.CREATE, changedById: actorId, reason } });
        created++;
      }
      return { created, households: primaryIdByHousehold.size };
    },
    { timeout: 60_000 },
  );
}

const INSTRUCTIONS: [MemberImportColumn, string, string, string][] = [
  ["household_id", "Yes", "Any value shared by a primary member and their dependents (e.g. employee ID or policy number). To add dependents to someone already in Nomad, use their member number (MBR-000123).", "EMP-0042"],
  ["relationship", "Dependents only", "Leave blank for the primary member. For dependents, a relationship code from the Codes sheet.", "SPOUSE"],
  ["first_name", "Yes", "", "Awa"],
  ["last_name", "Yes", "", "Ndiaye"],
  ["date_of_birth", "Recommended", "Day first (31/01/1986) or 1986-01-31, or an Excel date.", "12/04/1986"],
  ["sex", "No", "F or M. Leave blank if not specified.", "F"],
  ["email", "Needed to sign in", "Each member's own email; must be unique. Children usually have none.", "awa.ndiaye@example.com"],
  ["phone", "No", "Include the country code.", "+221 77 555 01 01"],
  ["preferred_language", "No", "fr or en. Defaults to fr.", "fr"],
  ["country_code", "No", "Two-letter country code from the Codes sheet.", "SN"],
  ["city", "No", "", "Dakar"],
  ["organization_code", "Group members", "Employer or insurer code from the Codes sheet. Leave blank for individual members.", "DEMO-EMPLOYER"],
  ["plan_name", "No", "", "Standard"],
  ["policy_number", "No", "", "POL-2026-0042"],
  ["coverage_start", "No", "Same date formats as date_of_birth.", "01/01/2026"],
  ["coverage_end", "No", "Must not be before coverage_start.", "31/12/2026"],
];

/** The import template: "Members" (headers only — no example rows that
 * could be imported by mistake), "Instructions" (one line per column) and
 * "Codes" (the organization, relationship and country codes in use today). */
export async function buildMemberTemplate(format: "xlsx" | "csv"): Promise<Buffer> {
  if (format === "csv") return Buffer.from(`${MEMBER_IMPORT_COLUMNS.join(",")}\n`, "utf8");

  const [organizations, relationships, countries] = await Promise.all([
    prisma.organizationRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.memberRelationshipRef.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.countryRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const wb = new ExcelJS.Workbook();
  const bold = { bold: true } as const;

  const members = wb.addWorksheet("Members", { views: [{ state: "frozen", ySplit: 1 }] });
  members.columns = MEMBER_IMPORT_COLUMNS.map((key) => ({ header: key, key, width: Math.max(14, key.length + 4) }));
  members.getRow(1).font = bold;
  // Dates as text in the date columns, so Excel doesn't reformat what staff type.
  for (const key of ["date_of_birth", "coverage_start", "coverage_end", "phone", "household_id"]) members.getColumn(key).numFmt = "@";

  const help = wb.addWorksheet("Instructions");
  help.columns = [
    { header: "Column", key: "column", width: 20 },
    { header: "Required", key: "required", width: 18 },
    { header: "How to fill it in", key: "how", width: 80 },
    { header: "Example", key: "example", width: 26 },
  ];
  help.getRow(1).font = bold;
  for (const [column, required, how, example] of INSTRUCTIONS) help.addRow({ column, required, how, example });
  help.getColumn("how").alignment = { wrapText: true, vertical: "top" };

  const codes = wb.addWorksheet("Codes");
  codes.columns = [
    { header: "List", key: "list", width: 16 },
    { header: "Code", key: "code", width: 22 },
    { header: "Name", key: "name", width: 36 },
  ];
  codes.getRow(1).font = bold;
  for (const o of organizations) codes.addRow({ list: "organization_code", code: o.code, name: `${o.name} (${o.kind.toLowerCase()})` });
  for (const r of relationships) codes.addRow({ list: "relationship", code: r.code, name: r.nameFr ? `${r.nameEn} / ${r.nameFr}` : r.nameEn });
  for (const c of countries) codes.addRow({ list: "country_code", code: c.iso2.trim(), name: c.name });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
