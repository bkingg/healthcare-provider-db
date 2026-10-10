import { describe, expect, it } from "vitest";
import { checkMedicationRows, medicationColumnFor, parsePriceXof, parseSourceDate, type RawMedicationRow } from "@/lib/import/medicationImport";

describe("medicationColumnFor — French ARP export headers", () => {
  it.each([
    ["﻿ID médicament NOMAD", "code"],
    ["Nom du médicament", "brand_name"],
    ["Numéro AMM", "amm_number"],
    ["Prix public officiel (XOF)", "official_price_xof"],
    ["Principe actif / DCI", "dci"],
    ["Voie d’administration", "route"],
    ["Fabricant / Laboratoire", "manufacturer"],
    ["Date de consultation de la source", "source_date"],
    ["Statut de l’enregistrement", "registration_status"],
    ["Chaîne du froid requise", "cold_chain"],
    ["brand_name", "brand_name"],
    ["Brand Name", "brand_name"],
  ])("%s → %s", (header, column) => expect(medicationColumnFor(header)).toBe(column));
  it("ignores columns it doesn't use", () => {
    expect(medicationColumnFor("Devise")).toBeNull();
    expect(medicationColumnFor("Code pays")).toBeNull();
  });
});

describe("parsePriceXof / parseSourceDate", () => {
  it("reads prices; 0 or empty means no official price", () => {
    expect(parsePriceXof("512.0")).toBe(512);
    expect(parsePriceXof("1 234")).toBe(1234);
    expect(parsePriceXof("1234,50 FCFA")).toBe(1235);
    expect(parsePriceXof("0.0")).toBeNull();
    expect(parsePriceXof("")).toBeNull();
    expect(parsePriceXof("cher")).toBeNaN();
  });
  it("reads ISO and French dates", () => {
    expect(parseSourceDate("2026-10-06")).toBe("2026-10-06");
    expect(parseSourceDate("6/10/2026")).toBe("2026-10-06");
    expect(parseSourceDate("")).toBeNull();
    expect(parseSourceDate("2026-02-30")).toBe("");
  });
});

describe("checkMedicationRows — an ARP row", () => {
  const row: RawMedicationRow = {
    code: "sn-arp-000002",
    brand_name: "5 DF",
    amm_number: "9189",
    official_price_xof: "512.0",
    dci: "CHLORURE DE SODIUM",
    strength: "5 g",
    presentation: "FL/100ml",
    form: "solution pour perfusion",
    route: "intraveineuse",
    manufacturer: "ACULIFE HEALTHCARE PVT",
    therapeutic_class: "SOLUTION POUR REHYDRATATION",
    source_authority: "Agence sénégalaise de Réglementation pharmaceutique (ARP)",
    source: "Liste des AMMs",
    source_url: "https://arp.sn/liste-des-amms/",
    source_date: "2026-10-06",
    price_status: "OFFICIAL_PRICE_AVAILABLE",
    registration_status: "ACTIVE_REFERENCE",
  };
  it("maps every field; empty safety flags stay off", () => {
    const [r] = checkMedicationRows([row], new Map());
    expect(r.errors).toEqual([]);
    expect(r.action).toBe("NEW");
    expect(r.input).toMatchObject({
      code: "SN-ARP-000002",
      brandName: "5 DF",
      ammNumber: "9189",
      officialPriceXof: 512,
      source: "ARP — Liste des AMMs",
      sourceCheckedOn: "2026-10-06",
      route: "intraveineuse",
      isActive: true,
      prescriptionRequired: false,
      isColdChain: false,
      regulatoryClass: "NOT_LISTED",
    });
  });
  it("is unchanged when imported again", () => {
    const [first] = checkMedicationRows([row], new Map());
    const [again] = checkMedicationRows([row], new Map([[first.input!.code, first.input!]]));
    expect(again.action).toBe("UNCHANGED");
  });
  it("hides an item whose registration isn't active, and treats 'controlled' as a narcotic", () => {
    const [r] = checkMedicationRows([{ ...row, registration_status: "WITHDRAWN", controlled: "oui" }], new Map());
    expect(r.input).toMatchObject({ isActive: false, regulatoryClass: "NARCOTIC", prescriptionRequired: true });
  });
  it("reports a missing form", () => {
    const [r] = checkMedicationRows([{ ...row, form: undefined }], new Map());
    expect(r.errors).toContain("Missing form");
  });
});

describe("the ARP's full AMM list (liste_amm_arp_senegal)", () => {
  it.each([
    ["NOM DU MEDICAMENT", "brand_name"],
    ["Numero AMM", "amm_number"],
    ["Prix Public", "official_price_xof"],
    ["DCI", "dci"],
    ["dosage", "strength"],
    ["présentation", "presentation"],
    ["Forme Galénique", "form"],
    ["Laboratoire", "manufacturer"],
    ["classe thérapeutique", "therapeutic_class"],
    ["RCP (lien)", "rcp_url"],
    ["Photo (lien)", "photo_url"],
  ])("%s → %s", (header, column) => expect(medicationColumnFor(header)).toBe(column));

  it.each([
    ["F CF 18 287", 18287],
    ["F CF3 694", 3694],
    ["1 341,00 F CFA", 1341],
    ["27 557,00 F CFA", 27557],
    ["3047 FCFA", 3047],
    ["5120FCFA", 5120],
    ["885 F CFA", 885],
    ["13 410 F CFA", 13410],
    ["512", 512],
  ])("reads the price %s", (raw, value) => expect(parsePriceXof(raw)).toBe(value));

  it.each(["B/10", "FL/60ml", "################", "-2146830000"])("can't read %s as a price", (raw) => expect(parsePriceXof(raw)).toBeNaN());

  const row: RawMedicationRow = {
    brand_name: "DOLIPRANE",
    amm_number: "A RENSEIGNER",
    official_price_xof: "F CF 1 200",
    dci: "PARACETAMOL",
    strength: "500 mg",
    presentation: "B/16",
    form: "comprimé",
    route: "orale",
    manufacturer: "SANOFI",
    rcp_url: "rcp",
    photo_url: "https://drive.google.com/file/d/abc/view",
  };

  it("makes a stable code from the row, the same whatever the case or accents", () => {
    const [a] = checkMedicationRows([row], new Map(), { hasPriceColumn: true });
    const [b] = checkMedicationRows([{ ...row, brand_name: "doliprane", form: "Comprime" }], new Map(), { hasPriceColumn: true });
    expect(a.input!.code).toMatch(/^MED-[0-9A-F]{12}$/);
    expect(b.input!.code).toBe(a.input!.code);
    const [c] = checkMedicationRows([{ ...row, strength: "1000 mg" }], new Map(), { hasPriceColumn: true });
    expect(c.input!.code).not.toBe(a.input!.code);
  });

  it("cleans the AMM number, price and links", () => {
    const [r] = checkMedicationRows([row], new Map(), { hasPriceColumn: true, defaultSource: "ARP — Liste des AMM" });
    expect(r.errors).toEqual([]);
    expect(r.input).toMatchObject({ ammNumber: null, officialPriceXof: 1200, priceStatus: "OFFICIAL_PRICE_AVAILABLE", rcpUrl: null, photoUrl: row.photo_url, source: "ARP — Liste des AMM" });
  });

  it("keeps a row whose price can't be read, marked to verify", () => {
    const [r] = checkMedicationRows([{ ...row, official_price_xof: "B/10" }], new Map(), { hasPriceColumn: true });
    expect(r.errors).toEqual([]);
    expect(r.input).toMatchObject({ officialPriceXof: null, priceStatus: "UNREADABLE_VERIFY" });
    const [zero] = checkMedicationRows([{ ...row, official_price_xof: "0" }], new Map(), { hasPriceColumn: true });
    expect(zero.input!.priceStatus).toBe("ZERO_VERIFY");
    const [none] = checkMedicationRows([{ ...row, official_price_xof: undefined }], new Map(), { hasPriceColumn: true });
    expect(none.input!.priceStatus).toBe("MISSING_VERIFY");
  });

  it("reports an exact repeat as a duplicate", () => {
    const [, second] = checkMedicationRows([row, { ...row }], new Map(), { hasPriceColumn: true });
    expect(second.errors[0]).toMatch(/duplicate/);
  });
});
