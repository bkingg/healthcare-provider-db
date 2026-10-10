import { describe, expect, it } from "vitest";
import { formatPresentation, medicationLabel, needsPrescription, parseRegulatoryClass, parseYesNo, requirementsFor, triggersFor } from "../medications";

const base = { regulatoryClass: "NOT_LISTED" as const, isPsychotropic: false, isColdChain: false, prescriptionRequired: false };

describe("parseRegulatoryClass", () => {
  it("reads English and French spellings", () => {
    expect(parseRegulatoryClass("Liste I")).toBe("LIST_I");
    expect(parseRegulatoryClass("LIST_II")).toBe("LIST_II");
    expect(parseRegulatoryClass("stupéfiant")).toBe("NARCOTIC");
    expect(parseRegulatoryClass("")).toBe("NOT_LISTED");
    expect(parseRegulatoryClass("Liste III")).toBeNull();
  });
});

describe("parseYesNo", () => {
  it("reads yes/no in English and French", () => {
    expect(parseYesNo("Oui")).toBe(true);
    expect(parseYesNo("non")).toBe(false);
    expect(parseYesNo("")).toBe(false);
    expect(parseYesNo("maybe")).toBeNull();
  });
});

describe("prescriptions and requirements", () => {
  it("listed classes always need a prescription", () => {
    expect(needsPrescription({ regulatoryClass: "LIST_II", prescriptionRequired: false })).toBe(true);
    expect(needsPrescription({ regulatoryClass: "NOT_LISTED", prescriptionRequired: false })).toBe(false);
  });
  it("a narcotic triggers prescription + narcotic rules; insulin triggers cold chain", () => {
    expect(triggersFor({ ...base, regulatoryClass: "NARCOTIC", isPsychotropic: true })).toEqual(["PRESCRIPTION_REQUIRED", "NARCOTIC", "PSYCHOTROPIC"]);
    expect(triggersFor({ ...base, isColdChain: true })).toEqual(["COLD_CHAIN"]);
  });
  it("collects each active requirement once, in order", () => {
    const rules = [
      { code: "COLD", appliesTo: "COLD_CHAIN", isActive: true, sortOrder: 50 },
      { code: "RX", appliesTo: "PRESCRIPTION_REQUIRED", isActive: true, sortOrder: 10 },
      { code: "OLD", appliesTo: "PRESCRIPTION_REQUIRED", isActive: false, sortOrder: 5 },
      { code: "NARC", appliesTo: "NARCOTIC", isActive: true, sortOrder: 20 },
    ];
    const items = [{ ...base, regulatoryClass: "LIST_I" as const }, { ...base, regulatoryClass: "LIST_II" as const, isColdChain: true }];
    expect(requirementsFor(items, rules).map((r) => r.code)).toEqual(["RX", "COLD"]);
  });
  it("names an item from its generic, strength and form", () => {
    expect(medicationLabel({ dci: "Paracétamol", strength: "500mg", form: "comprimé" })).toBe("Paracétamol 500mg comprimé");
  });
});

describe("formatPresentation", () => {
  it("spells out the regulator's pack abbreviations", () => {
    expect(formatPresentation("B/30")).toBe("boîte de 30");
    expect(formatPresentation("FL/100ml")).toBe("flacon de 100ml");
    expect(formatPresentation("T/10g")).toBe("tube de 10g");
    expect(formatPresentation("Solution injectable en stylo prérempli")).toBe("Solution injectable en stylo prérempli");
    expect(formatPresentation("")).toBeNull();
  });
});
