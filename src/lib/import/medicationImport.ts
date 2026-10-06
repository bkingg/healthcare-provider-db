import { needsPrescription, parseRegulatoryClass, parseYesNo, type RegulatoryClass } from "@/lib/medications";

/** Medication catalog import (medication delivery, step 1). Pure functions —
 * the file is read in src/data/medicationImport.ts. Rows are matched to the
 * catalog by `code`, so re-importing an updated list updates in place. */

export const MEDICATION_IMPORT_COLUMNS = [
  "code",
  "dci",
  "brand_name",
  "strength",
  "form",
  "presentation",
  "therapeutic_class",
  "regulatory_class",
  "psychotropic",
  "cold_chain",
  "prescription_required",
  "source",
  "active",
] as const;

export type MedicationImportColumn = (typeof MEDICATION_IMPORT_COLUMNS)[number];
export type RawMedicationRow = Partial<Record<MedicationImportColumn, string>>;

export const MAX_MEDICATION_ROWS = 5000;
export const REQUIRED_MEDICATION_COLUMNS: MedicationImportColumn[] = ["code", "dci", "form"];

export type MedicationInput = {
  code: string;
  dci: string;
  brandName: string | null;
  strength: string | null;
  form: string;
  presentation: string | null;
  therapeuticClass: string | null;
  regulatoryClass: RegulatoryClass;
  isPsychotropic: boolean;
  isColdChain: boolean;
  prescriptionRequired: boolean;
  source: string | null;
  isActive: boolean;
};

export type CheckedMedicationRow = {
  rowNumber: number;
  raw: RawMedicationRow;
  input: MedicationInput | null;
  /** What saving would do: a new item, an update, or nothing (identical). */
  action: "NEW" | "UPDATE" | "UNCHANGED" | null;
  errors: string[];
};

/** "Brand Name" / "brand-name" / "BRAND_NAME" all match brand_name. */
export function normalizeMedicationHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const text = (v: string | undefined, max: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

const FIELDS: (keyof MedicationInput)[] = [
  "dci", "brandName", "strength", "form", "presentation", "therapeuticClass", "regulatoryClass",
  "isPsychotropic", "isColdChain", "prescriptionRequired", "source", "isActive",
];

/** Checks every row. `existing` is the catalog keyed by code (uppercase), to
 * tell new items from updates. A listed class always means "prescription
 * required", whatever the column says. */
export function checkMedicationRows(rows: RawMedicationRow[], existing: Map<string, MedicationInput>, defaultSource: string | null = null): CheckedMedicationRow[] {
  const seen = new Map<string, number>();
  return rows.map((raw, i) => {
    const rowNumber = i + 2;
    const errors: string[] = [];
    const code = (raw.code ?? "").trim().toUpperCase();
    const dci = text(raw.dci, 200);
    const form = text(raw.form, 100);
    if (!code) errors.push("Missing code");
    else if (!/^[A-Z0-9._-]{1,40}$/.test(code)) errors.push("Code can only use letters, numbers, dots, dashes and underscores (max 40)");
    else if (seen.has(code)) errors.push(`Same code as row ${seen.get(code)}`);
    if (code) seen.set(code, rowNumber);
    if (!dci) errors.push("Missing DCI (generic name)");
    if (!form) errors.push("Missing form");
    const regulatoryClass = parseRegulatoryClass(raw.regulatory_class);
    if (!regulatoryClass) errors.push(`Unknown regulatory class "${raw.regulatory_class}" — use NOT_LISTED, LIST_II, LIST_I or NARCOTIC`);
    const flags = {
      isPsychotropic: parseYesNo(raw.psychotropic),
      isColdChain: parseYesNo(raw.cold_chain),
      prescriptionRequired: parseYesNo(raw.prescription_required),
      isActive: raw.active?.trim() ? parseYesNo(raw.active) : true,
    };
    for (const [k, v] of Object.entries(flags)) if (v === null) errors.push(`${k}: use yes or no`);

    if (errors.length) return { rowNumber, raw, input: null, action: null, errors };
    const input: MedicationInput = {
      code,
      dci: dci!,
      brandName: text(raw.brand_name, 200),
      strength: text(raw.strength, 100),
      form: form!,
      presentation: text(raw.presentation, 200),
      therapeuticClass: text(raw.therapeutic_class, 200),
      regulatoryClass: regulatoryClass!,
      isPsychotropic: flags.isPsychotropic!,
      isColdChain: flags.isColdChain!,
      prescriptionRequired: needsPrescription({ regulatoryClass: regulatoryClass!, prescriptionRequired: flags.prescriptionRequired! }),
      source: text(raw.source, 100) ?? defaultSource,
      isActive: flags.isActive!,
    };
    const before = existing.get(code);
    const action = !before ? "NEW" : FIELDS.some((f) => before[f] !== input[f]) ? "UPDATE" : "UNCHANGED";
    return { rowNumber, raw, input, action, errors };
  });
}

export function summarizeMedications(rows: CheckedMedicationRow[]) {
  const count = (a: CheckedMedicationRow["action"]) => rows.filter((r) => r.action === a).length;
  return { total: rows.length, new: count("NEW"), updated: count("UPDATE"), unchanged: count("UNCHANGED"), withErrors: rows.filter((r) => r.errors.length).length };
}
