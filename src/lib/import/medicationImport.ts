import { needsPrescription, parseRegulatoryClass, parseYesNo, type RegulatoryClass } from "@/lib/medications";

/** Medication catalog import (medication delivery, step 1). Pure functions —
 * the file is read in src/data/medicationImport.ts. Rows are matched to the
 * catalog by `code`, so re-importing an updated list updates in place. A
 * file without codes (the ARP's own AMM list) gets codes made from each
 * row's name, AMM number, dosage, pack and form — the same row always gets
 * the same code. */

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
  "amm_number",
  "official_price_xof",
  "price_status",
  "manufacturer",
  "route",
  "source_url",
  "source_date",
  "notes",
  "rcp_url",
  "photo_url",
] as const;

/** Read from a file but not written back as columns of their own:
 * `source_authority` joins `source`, `registration_status` sets `active`,
 * `controlled` marks a narcotic when no regulatory class is given. */
const EXTRA_COLUMNS = ["source_authority", "registration_status", "controlled"] as const;

export type MedicationImportColumn = (typeof MEDICATION_IMPORT_COLUMNS)[number] | (typeof EXTRA_COLUMNS)[number];
export type RawMedicationRow = Partial<Record<MedicationImportColumn, string>>;

export const MAX_MEDICATION_ROWS = 10000;
/** `code` may be left out: codes are then made from the row (see codeFor). */
export const REQUIRED_MEDICATION_COLUMNS: MedicationImportColumn[] = ["dci", "form"];

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
  ammNumber: string | null;
  officialPriceXof: number | null;
  priceStatus: string | null;
  manufacturer: string | null;
  route: string | null;
  sourceUrl: string | null;
  /** YYYY-MM-DD. */
  sourceCheckedOn: string | null;
  notes: string | null;
  rcpUrl: string | null;
  photoUrl: string | null;
};

export type CheckedMedicationRow = {
  rowNumber: number;
  raw: RawMedicationRow;
  input: MedicationInput | null;
  /** What saving would do: a new item, an update, or nothing (identical). */
  action: "NEW" | "UPDATE" | "UNCHANGED" | null;
  errors: string[];
};

/** "Brand Name" / "brand-name" / "BRAND_NAME" all match brand_name;
 * accents, apostrophes and brackets are ignored ("Voie d’administration"
 * → voie_d_administration, "Prix public officiel (XOF)" →
 * prix_public_officiel_xof). */
export function normalizeMedicationHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** The French headers of Nomad's ARP list export
 * (NOMAD_Medicaments_Senegal_ARP_Import_FR), normalized. "Devise" and "Code
 * pays" (always XOF / SN) are ignored. */
const FRENCH_HEADERS: Record<string, MedicationImportColumn> = {
  id_medicament_nomad: "code",
  nom_du_medicament: "brand_name",
  numero_amm: "amm_number",
  prix_public_officiel_xof: "official_price_xof",
  principe_actif_dci: "dci",
  dosage: "strength",
  presentation: "presentation",
  forme_pharmaceutique: "form",
  voie_d_administration: "route",
  fabricant_laboratoire: "manufacturer",
  classe_therapeutique: "therapeutic_class",
  autorite_reglementaire: "source_authority",
  registre_source: "source",
  url_source: "source_url",
  date_de_consultation_de_la_source: "source_date",
  statut_du_prix: "price_status",
  statut_de_l_enregistrement: "registration_status",
  ordonnance_requise: "prescription_required",
  medicament_controle: "controlled",
  chaine_du_froid_requise: "cold_chain",
  notes_nomad: "notes",
  // The ARP's full AMM list (liste_amm_arp_senegal).
  prix_public: "official_price_xof",
  forme_galenique: "form",
  laboratoire: "manufacturer",
  rcp_lien: "rcp_url",
  photo_lien: "photo_url",
};

const KNOWN_COLUMNS = new Set<string>([...MEDICATION_IMPORT_COLUMNS, ...EXTRA_COLUMNS]);

/** The import column a file header stands for, or null to ignore it. */
export function medicationColumnFor(header: string): MedicationImportColumn | null {
  const h = normalizeMedicationHeader(header);
  if (KNOWN_COLUMNS.has(h)) return h as MedicationImportColumn;
  return FRENCH_HEADERS[h] ?? null;
}

/** Prices as the lists write them — "512", "512.0", "1 234", "1 341,00 F
 * CFA", "F CF 18 287", "5120FCFA" — in whole FCFA. Empty or 0 → null (no
 * price). Anything else (a pack size in the price column, "#####", a
 * negative number) → NaN: the price can't be read. */
export function parsePriceXof(v: string | undefined): number | null {
  const t = (v ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/^(FCFA|FCF|XOF|F)|(FCFA|FCF|XOF|F)$/gi, "");
  if (!t) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(t)) return NaN;
  const n = Number(t.replace(",", "."));
  return n === 0 ? null : Math.round(n);
}

/** The price status a list gives, or — when it gives none — one worked out
 * from the price column, in the same words the ARP export uses. */
function priceStatusFor(given: string | undefined, raw: string | undefined, price: number | null, hasPriceColumn: boolean): string | null {
  const g = given?.trim().toUpperCase();
  if (g) return g.slice(0, 40);
  if (!hasPriceColumn) return null;
  if (Number.isNaN(price)) return "UNREADABLE_VERIFY";
  if (price !== null) return "OFFICIAL_PRICE_AVAILABLE";
  return raw?.trim() ? "ZERO_VERIFY" : "MISSING_VERIFY";
}

/** A stable code for a row that has none: "MED-" + 12 hex characters of a
 * hash of its name, AMM number, dosage, pack and form (case, accents and
 * spacing ignored). Two FNV-1a hashes — pure JS, the same anywhere. */
export function codeFor(raw: RawMedicationRow): string {
  const key = [raw.brand_name, raw.dci, raw.amm_number, raw.strength, raw.presentation, raw.form]
    .map((v) =>
      (v ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim(),
    )
    .join("|");
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  };
  return `MED-${fnv(0x811c9dc5).toString(16).padStart(8, "0")}${fnv(0x01000193).toString(16).padStart(8, "0").slice(0, 4)}`.toUpperCase();
}

/** Only real links are kept (the ARP list has "rcp" or a number in some). */
const link = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return /^https?:\/\/\S+$/i.test(t) ? t.slice(0, 500) : null;
};

/** "2026-10-06" or "06/10/2026" → "2026-10-06"; empty → null; not a real
 * date → "" (an error). */
export function parseSourceDate(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : fr ? [fr[3], fr[2].padStart(2, "0"), fr[1].padStart(2, "0")] : [];
  if (!y) return "";
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(d) ? "" : `${y}-${m}-${d}`;
}

const text = (v: string | undefined, max: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

const FIELDS: (keyof MedicationInput)[] = [
  "dci", "brandName", "strength", "form", "presentation", "therapeuticClass", "regulatoryClass",
  "isPsychotropic", "isColdChain", "prescriptionRequired", "source", "isActive",
  "ammNumber", "officialPriceXof", "priceStatus", "manufacturer", "route", "sourceUrl", "sourceCheckedOn", "notes",
  "rcpUrl", "photoUrl",
];

export type CheckOptions = {
  /** Used for rows whose source column is empty. */
  defaultSource?: string | null;
  /** The file has a price column: rows without a price status get one. */
  hasPriceColumn?: boolean;
};

/** Checks every row. `existing` is the catalog keyed by code (uppercase), to
 * tell new items from updates. A listed class always means "prescription
 * required", whatever the column says. */
export function checkMedicationRows(rows: RawMedicationRow[], existing: Map<string, MedicationInput>, options: CheckOptions = {}): CheckedMedicationRow[] {
  const { defaultSource = null, hasPriceColumn = false } = options;
  const seen = new Map<string, number>();
  return rows.map((raw, i) => {
    const rowNumber = i + 2;
    const errors: string[] = [];
    const code = (raw.code?.trim() ? raw.code : codeFor(raw)).trim().toUpperCase();
    const dci = text(raw.dci, 200);
    const form = text(raw.form, 100);
    if (!code) errors.push("Missing code");
    else if (!/^[A-Z0-9._-]{1,40}$/.test(code)) errors.push("Code can only use letters, numbers, dots, dashes and underscores (max 40)");
    else if (seen.has(code)) errors.push(raw.code?.trim() ? `Same code as row ${seen.get(code)}` : `Same medicine as row ${seen.get(code)} (duplicate)`);
    if (code) seen.set(code, rowNumber);
    if (!dci) errors.push("Missing DCI (generic name)");
    if (!form) errors.push("Missing form");
    const controlled = parseYesNo(raw.controlled);
    if (controlled === null) errors.push("controlled: use yes or no");
    // A controlled medicine with no class given is treated as a narcotic.
    const regulatoryClass = !raw.regulatory_class?.trim() && controlled ? "NARCOTIC" : parseRegulatoryClass(raw.regulatory_class);
    if (!regulatoryClass) errors.push(`Unknown regulatory class "${raw.regulatory_class}" — use NOT_LISTED, LIST_II, LIST_I or NARCOTIC`);
    // A registration status other than active (withdrawn, suspended…) hides the item.
    const registration = (raw.registration_status ?? "").trim().toUpperCase();
    const flags = {
      isPsychotropic: parseYesNo(raw.psychotropic),
      isColdChain: parseYesNo(raw.cold_chain),
      prescriptionRequired: parseYesNo(raw.prescription_required),
      isActive: raw.active?.trim() ? parseYesNo(raw.active) : registration ? registration.startsWith("ACTIVE") : true,
    };
    for (const [k, v] of Object.entries(flags)) if (v === null) errors.push(`${k}: use yes or no`);
    // An unreadable price doesn't stop the row: it's saved without a price,
    // marked to verify.
    const officialPriceXof = parsePriceXof(raw.official_price_xof);
    const priceStatus = priceStatusFor(raw.price_status, raw.official_price_xof, officialPriceXof, hasPriceColumn);
    const sourceCheckedOn = parseSourceDate(raw.source_date);
    if (sourceCheckedOn === "") errors.push(`Source date "${raw.source_date}" — use YYYY-MM-DD or DD/MM/YYYY`);
    // "Agence … (ARP)" + "Liste des AMMs" → "ARP — Liste des AMMs".
    const authority = text(raw.source_authority, 120);
    const authorityShort = authority ? (/\(([^)]+)\)\s*$/.exec(authority)?.[1] ?? authority) : null;
    const source = text([authorityShort, raw.source?.trim()].filter(Boolean).join(" — "), 100);

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
      source: source ?? defaultSource,
      isActive: flags.isActive!,
      // "A RENSEIGNER", "NR" and the like aren't numbers.
      ammNumber: /\d/.test(raw.amm_number ?? "") ? text(raw.amm_number, 40) : null,
      officialPriceXof: Number.isNaN(officialPriceXof) ? null : officialPriceXof,
      priceStatus,
      manufacturer: text(raw.manufacturer, 200),
      route: text(raw.route, 100),
      sourceUrl: text(raw.source_url, 500),
      sourceCheckedOn,
      notes: text(raw.notes, 1000),
      rcpUrl: link(raw.rcp_url),
      photoUrl: link(raw.photo_url),
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
