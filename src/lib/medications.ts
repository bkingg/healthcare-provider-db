/** Medication catalog rules (medication delivery, step 1). Pure functions —
 * shared by the import, the admin catalog and (later) ordering. */

export const REGULATORY_CLASSES = ["NOT_LISTED", "LIST_II", "LIST_I", "NARCOTIC"] as const;
export type RegulatoryClass = (typeof REGULATORY_CLASSES)[number];

export type RequirementTrigger = "PRESCRIPTION_REQUIRED" | "LIST_II" | "LIST_I" | "NARCOTIC" | "PSYCHOTROPIC" | "COLD_CHAIN";

type Flags = { regulatoryClass: RegulatoryClass; isPsychotropic: boolean; isColdChain: boolean; prescriptionRequired: boolean };

/** Anything on a list (Liste I, Liste II, narcotics) needs a prescription;
 * an unlisted item only when it's been marked so. */
export function needsPrescription(m: Pick<Flags, "regulatoryClass" | "prescriptionRequired">): boolean {
  return m.prescriptionRequired || m.regulatoryClass !== "NOT_LISTED";
}

/** What an item triggers, for matching against the requirement rules. */
export function triggersFor(m: Flags): RequirementTrigger[] {
  const out: RequirementTrigger[] = [];
  if (needsPrescription(m)) out.push("PRESCRIPTION_REQUIRED");
  if (m.regulatoryClass !== "NOT_LISTED") out.push(m.regulatoryClass);
  if (m.isPsychotropic) out.push("PSYCHOTROPIC");
  if (m.isColdChain) out.push("COLD_CHAIN");
  return out;
}

/** Every active requirement any of the items triggers, once each, in the
 * rules' order — what an order containing these items needs. */
export function requirementsFor<R extends { appliesTo: string; isActive: boolean; sortOrder: number }>(items: Flags[], rules: R[]): R[] {
  const triggered = new Set(items.flatMap(triggersFor));
  return rules.filter((r) => r.isActive && triggered.has(r.appliesTo as RequirementTrigger)).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** "Paracétamol 500mg comprimé" — how an item is named in lists and orders. */
export function medicationLabel(m: { dci: string; strength: string | null; form: string }): string {
  return [m.dci, m.strength, m.form].filter(Boolean).join(" ");
}

const strip = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

/** A regulatory class as typed in a file — English or French, e.g. "LIST_I",
 * "Liste I", "I", "stupéfiant". Empty = not listed. Null if unrecognised. */
export function parseRegulatoryClass(raw: string | undefined): RegulatoryClass | null {
  const v = strip(raw ?? "");
  if (["", "not listed", "none", "non liste", "aucune", "aucun", "otc"].includes(v)) return "NOT_LISTED";
  if (["list ii", "liste ii", "ii", "2", "list 2", "liste 2"].includes(v)) return "LIST_II";
  if (["list i", "liste i", "i", "1", "list 1", "liste 1"].includes(v)) return "LIST_I";
  if (["narcotic", "narcotics", "stupefiant", "stupefiants"].includes(v)) return "NARCOTIC";
  return null;
}

/** yes/no in English or French (oui/non), true/false, 1/0, x. Empty = no.
 * Null if unrecognised. */
export function parseYesNo(raw: string | undefined): boolean | null {
  const v = strip(raw ?? "");
  if (["", "no", "non", "false", "0", "n"].includes(v)) return false;
  if (["yes", "oui", "true", "1", "y", "o", "x"].includes(v)) return true;
  return null;
}
