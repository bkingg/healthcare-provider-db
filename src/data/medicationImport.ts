import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import {
  MAX_MEDICATION_ROWS,
  MEDICATION_IMPORT_COLUMNS,
  REQUIRED_MEDICATION_COLUMNS,
  medicationColumnFor,
  type CheckedMedicationRow,
  type MedicationInput,
  type RawMedicationRow,
} from "@/lib/import/medicationImport";
import { readSheetFile } from "./sheetFile";

const SHEET = "Medications";

export async function readMedicationFile(file: File): Promise<{ rows: RawMedicationRow[]; fileErrors: string[]; hasPriceColumn: boolean }> {
  const { headers, records, fileErrors } = await readSheetFile(file, SHEET);
  if (fileErrors.length) return { rows: [], fileErrors, hasPriceColumn: false };
  // English template headers, or the French ones of Nomad's ARP list export.
  const columns = headers.map(medicationColumnFor);
  const missing = REQUIRED_MEDICATION_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) return { rows: [], hasPriceColumn: false, fileErrors: [`Missing required column(s): ${missing.join(", ")}. Start from the template so the headers match.`] };
  const rows = records.map((record) => {
    const row: RawMedicationRow = {};
    for (const [header, value] of Object.entries(record)) {
      const key = medicationColumnFor(header);
      const v = value?.trim();
      if (key && v) row[key] = v;
    }
    return row;
  });
  if (rows.length > MAX_MEDICATION_ROWS) return { rows: [], hasPriceColumn: false, fileErrors: [`The file has ${rows.length} rows; the limit is ${MAX_MEDICATION_ROWS} per upload. Split it into smaller files.`] };
  return { rows, fileErrors: [], hasPriceColumn: columns.includes("official_price_xof") };
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
        ammNumber: m.ammNumber,
        officialPriceXof: m.officialPriceXof,
        priceStatus: m.priceStatus,
        manufacturer: m.manufacturer,
        route: m.route,
        sourceUrl: m.sourceUrl,
        sourceCheckedOn: m.sourceCheckedOn ? m.sourceCheckedOn.toISOString().slice(0, 10) : null,
        notes: m.notes,
        rcpUrl: m.rcpUrl,
        photoUrl: m.photoUrl,
      },
    ]),
  );
}

/** Saves the new and changed rows (never ones with errors) in one
 * transaction, with an audit row each naming the file — new items in
 * batches, so a full national list (7,000+ rows) saves in seconds.
 * `isSample` marks example data so it can be told apart and removed. With
 * `replace`, every other active item (one not in this file) is switched off
 * — kept for past orders, hidden from ordering. */
export async function commitMedicationImport(rows: CheckedMedicationRow[], fileName: string, actorId: string | null, isSample = false, replace = false) {
  const valid = rows.filter((r) => r.input);
  const toData = (input: MedicationInput) => {
    const { code, sourceCheckedOn, ...rest } = input;
    return { code, data: { ...rest, sourceCheckedOn: sourceCheckedOn ? new Date(`${sourceCheckedOn}T00:00:00Z`) : null } };
  };
  const reason = `Medication import: ${fileName}`;
  const result = await prisma.$transaction(
    async (tx) => {
      const created: string[] = [];
      const updated: string[] = [];
      const fresh = valid.filter((r) => r.action === "NEW").map((r) => toData(r.input!));
      for (let i = 0; i < fresh.length; i += 500) {
        const batch = await tx.medication.createManyAndReturn({
          data: fresh.slice(i, i + 500).map(({ code, data }) => ({ code, ...data, isSample, createdBy: actorId, updatedBy: actorId })),
          select: { id: true },
        });
        created.push(...batch.map((b) => b.id));
      }
      for (const r of valid.filter((x) => x.action === "UPDATE")) {
        const { code, data } = toData(r.input!);
        const m = await tx.medication.update({ where: { code }, data: { ...data, updatedBy: actorId }, select: { id: true } });
        updated.push(m.id);
      }
      let switchedOff: string[] = [];
      if (replace) {
        const keep = valid.map((r) => r.input!.code);
        const others = await tx.medication.findMany({ where: { isActive: true, code: { notIn: keep } }, select: { id: true } });
        switchedOff = others.map((o) => o.id);
        if (switchedOff.length) await tx.medication.updateMany({ where: { id: { in: switchedOff } }, data: { isActive: false, updatedBy: actorId } });
      }
      return { created, updated, switchedOff };
    },
    { timeout: 120_000 },
  );
  if (actorId) {
    const audit = [
      ...result.created.map((id) => ({ entityType: "Medication", entityId: id, action: AuditAction.CREATE, changedById: actorId, reason })),
      ...result.updated.map((id) => ({ entityType: "Medication", entityId: id, action: AuditAction.UPDATE, changedById: actorId, reason })),
      ...result.switchedOff.map((id) => ({
        entityType: "Medication",
        entityId: id,
        action: AuditAction.UPDATE,
        changedById: actorId,
        fieldName: "isActive",
        previousValue: "true",
        newValue: "false",
        reason: `${reason} (not in the file — replaced)`,
      })),
    ];
    for (let i = 0; i < audit.length; i += 1000) await prisma.auditLog.createMany({ data: audit.slice(i, i + 1000) });
  }
  return { created: result.created.length, updated: result.updated.length, switchedOff: result.switchedOff.length };
}

const INSTRUCTIONS: [string, string, string, string][] = [
  ["code", "No", "Stable ID for the item, unique. Leave the column out and codes are made from each row's name, AMM number, dosage, pack and form. Re-importing a row with the same code updates it. Letters, numbers, dots, dashes, underscores.", "LNMPE-195"],
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
  ["amm_number", "No", "Marketing authorisation number (Numéro AMM).", "9189"],
  ["official_price_xof", "No", "Official public price per pack, FCFA. Empty or 0 = no official price.", "512"],
  ["price_status", "No", "The source's word on the price.", "OFFICIAL_PRICE_AVAILABLE"],
  ["manufacturer", "No", "Manufacturer / laboratory.", "SANOFI"],
  ["route", "No", "Route of administration.", "orale"],
  ["source_url", "No", "Link to the source list.", "https://arp.sn/liste-des-amms/"],
  ["source_date", "No", "When the source was consulted: YYYY-MM-DD or DD/MM/YYYY.", "2026-10-06"],
  ["notes", "No", "Nomad's own notes.", ""],
  ["rcp_url", "No", "Link to the product information sheet (RCP).", "https://…"],
  ["photo_url", "No", "Link to a photo of the pack.", "https://…"],
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
