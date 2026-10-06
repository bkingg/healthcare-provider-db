import { describe, expect, it } from "vitest";
import { checkMedicationRows, normalizeMedicationHeader, summarizeMedications, type MedicationInput } from "../medicationImport";

const row = { code: "lnmpe-195", dci: "Paracétamol", strength: "500mg", form: "comprimé", brand_name: "Doliprane", regulatory_class: "", cold_chain: "non" };

describe("checkMedicationRows", () => {
  it("accepts a good row as new, with code uppercased", () => {
    const [r] = checkMedicationRows([row], new Map());
    expect(r.errors).toEqual([]);
    expect(r.action).toBe("NEW");
    expect(r.input).toMatchObject({ code: "LNMPE-195", regulatoryClass: "NOT_LISTED", prescriptionRequired: false, isActive: true });
  });
  it("forces prescription for listed classes", () => {
    const [r] = checkMedicationRows([{ ...row, regulatory_class: "stupéfiant", prescription_required: "no" }], new Map());
    expect(r.input).toMatchObject({ regulatoryClass: "NARCOTIC", prescriptionRequired: true });
  });
  it("reports missing fields, bad values and repeated codes", () => {
    const rows = checkMedicationRows([{ code: "A1", form: "sirop" }, { ...row, code: "A1", regulatory_class: "Liste IV", cold_chain: "maybe" }], new Map());
    expect(rows[0].errors).toEqual(["Missing DCI (generic name)"]);
    expect(rows[1].errors).toEqual(expect.arrayContaining(["Same code as row 2", expect.stringContaining("Unknown regulatory class"), "isColdChain: use yes or no"]));
  });
  it("tells updates from unchanged rows by code", () => {
    const [first] = checkMedicationRows([row], new Map());
    const existing = new Map<string, MedicationInput>([["LNMPE-195", first.input!]]);
    expect(checkMedicationRows([row], existing)[0].action).toBe("UNCHANGED");
    const changed = checkMedicationRows([{ ...row, brand_name: "Efferalgan" }], existing);
    expect(changed[0].action).toBe("UPDATE");
    expect(summarizeMedications(changed)).toMatchObject({ updated: 1, new: 0 });
  });
  it("matches headers however they're written", () => {
    expect(normalizeMedicationHeader(" Brand Name ")).toBe("brand_name");
    expect(normalizeMedicationHeader("cold-chain")).toBe("cold_chain");
  });
});
