import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import {
  MAX_MEDICATION_ROWS,
  MEDICATION_IMPORT_COLUMNS,
  REQUIRED_MEDICATION_COLUMNS,
  normalizeMedicationHeader,
  type CheckedMedicationRow,
  type MedicationInput,
  type RawMedicationRow,
} from "@/lib/import/medicationImport";
import { readSheetFile } from "./sheetFile";
import { writeAudit } from "./audit";

const KNOWN = new Set<string>(MEDICATION_IMPORT_COLUMNS);
const SHEET = "Medications";

export async function readMedicationFile(file: File): Promise<{ rows: RawMedicationRow[]; fileErrors: string[] }> {
  const { headers, records, fileErrors } = await readSheetFile(file, SHEET);
  if (fileErrors.length) return { rows: [], fileErrors };
  const normalized = headers.map(normalizeMedicationHeader);
  const missing = REQUIRED_MEDICATION_COLUMNS.filter((c) => !normalized.includes(c));
  if (missing.length) return { rows: [], fileErrors: [`Missing required column(s): ${missing.join(", ")}. Start from the template so the headers match.`] };
  const rows = records.map((record) => {
    const row: RawMedicationRow = {};
    for (const [header, value] of Object.entries(record)) {
      const key = normalizeMedicationHeader(header);
      const v = value?.trim();
      if (KNOWN.has(key) && v) row[key as keyof RawMedicationRow] = v;
    }
    return row;
  });
  if (rows.length > MAX_MEDICATION_ROWS) return { rows: [], fileErrors: [`The file has ${rows.length} rows; the limit is ${MAX_MEDICATION_ROWS} per upload. Split it into smaller files.`] };
  return { rows, fileErrors: [] };
}

/** The catalog keyed by code, in the import's shape — to tell new items
 * from updates and unchanged rows. */
export async function loadCatalogByCode(): Promise<Map<string, MedicationInput>> {
  const all = await prisma.medication.findMany();
  return new Map(
    all.map((m) => [
      m.code,
      {
        code: m.code,
        dci: m.dci,
        brandName: m.brandName,
        strength: m.strength,
        form: m.form,
        presentation: m.presentation,
        therapeuticClass: m.therapeuticClass,
        regulatoryClass: m.regulatoryClass,
        isPsychotropic: m.isPsychotropic,
        isColdChain: m.isColdChain,
        prescriptionRequired: m.prescriptionRequired,
        source: m.source,
        isActive: m.isActive,
      },
    ]),
  );
}

/** Saves the new and changed rows (never ones with errors) in one
 * transaction, with an audit row each naming the file. `isSample` marks
 * example data so it can be told apart and removed. */
export async function commitMedicationImport(rows: CheckedMedicationRow[], fileName: string, actorId: string | null, isSample = false) {
  const ready = rows.filter((r) => r.input && (r.action === "NEW" || r.action === "UPDATE"));
  const reason = `Medication import: ${fileName}`;
  const saved = await prisma.$transaction(
    async (tx) => {
      const out: { id: string; action: "NEW" | "UPDATE" }[] = [];
      for (const r of ready) {
        const { code, ...data } = r.input!;
        const m = await tx.medication.upsert({
          where: { code },
          create: { code, ...data, isSample, createdBy: actorId, updatedBy: actorId },
          update: { ...data, updatedBy: actorId },
        });
        out.push({ id: m.id, action: r.action as "NEW" | "UPDATE" });
      }
      return out;
    },
    { timeout: 60_000 },
  );
  if (actorId) {
    for (const s of saved) await writeAudit({ entityType: "Medication", entityId: s.id, action: s.action === "NEW" ? AuditAction.CREATE : AuditAction.UPDATE, actorId, reason });
  }
  return { created: saved.filter((s) => s.action === "NEW").length, updated: saved.filter((s) => s.action === "UPDATE").length };
}

const INSTRUCTIONS: [string, string, string, string][] = [
  ["code", "Yes", "Stable ID for the item, unique. Re-importing a row with the same code updates it. Letters, numbers, dots, dashes, underscores.", "LNMPE-195"],
  ["dci", "Yes", "Generic name (DCI / INN).", "Paracétamol"],
  ["brand_name", "No", "Usual brand (the LNMPE's \"Référence\").", "Doliprane"],
  ["strength", "No", "Dosage as written in the source.", "500mg"],
  ["form", "Yes", "Pharmaceutical form.", "comprimé"],
  ["presentation", "No", "Pack size.", "boîte de 16"],
  ["therapeutic_class", "No", "Section of the list it comes from.", "Antalgiques non opioïdes"],
  ["regulatory_class", "No", "NOT_LISTED (empty), LIST_II, LIST_I or NARCOTIC. French works too: Liste II, Liste I, stupéfiant. Anything listed needs a prescription.", "LIST_I"],
  ["psychotropic", "No", "yes / no (oui / non). Empty = no.", "no"],
  ["cold_chain", "No", "yes if it must be kept at 2–8 °C in transit (e.g. insulin).", "no"],
  ["prescription_required", "No", "yes to require a prescription for an unlisted item. Always yes for listed classes.", "no"],
  ["source", "No", "Where the row comes from.", "LNMPE 2025"],
  ["active", "No", "no to hide the item from ordering. Empty = yes.", "yes"],
];

export async function buildMedicationTemplate(format: "xlsx" | "csv"): Promise<Buffer> {
  if (format === "csv") return Buffer.from(`${MEDICATION_IMPORT_COLUMNS.join(",")}\n`, "utf8");
  const wb = new ExcelJS.Workbook();
  const bold = { bold: true } as const;
  const sheet = wb.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = MEDICATION_IMPORT_COLUMNS.map((key) => ({ header: key, key, width: Math.max(14, key.length + 4) }));
  sheet.getRow(1).font = bold;
  // Text, so Excel doesn't reformat codes or strengths like "1/2".
  for (const key of ["code", "strength"]) sheet.getColumn(key).numFmt = "@";

  const help = wb.addWorksheet("Instructions");
  help.columns = [
    { header: "Column", key: "column", width: 22 },
    { header: "Required", key: "required", width: 10 },
    { header: "How to fill it in", key: "how", width: 80 },
    { header: "Example", key: "example", width: 26 },
  ];
  help.getRow(1).font = bold;
  for (const [column, required, how, example] of INSTRUCTIONS) help.addRow({ column, required, how, example });
  help.getColumn("how").alignment = { wrapText: true, vertical: "top" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
