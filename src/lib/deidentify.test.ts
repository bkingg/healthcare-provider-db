import { describe, expect, it } from "vitest";
import { Redactor } from "./deidentify";

describe("Redactor", () => {
  const make = () =>
    new Redactor()
      .person("MEMBER", "Awa", "Ndiaye")
      .person("PATIENT", "Aminata", "Fall")
      .phone("+221 77 555 01 01")
      .detail("MEMBER_NUMBER", "MBR-000001")
      .detail("POLICY", "POL-88412")
      .detail("ADDRESS", "Rue 10 x Rue 15, Médina");

  it("takes out names, numbers and the address", () => {
    const r = make();
    const out = r.redact("Bonjour, je suis Awa NDIAYE (MBR-000001), pour ma fille Aminata. Appelez le 77 555 01 01 ou 775550101. Adresse : Rue 10 x Rue 15, Médina. Police POL-88412.");
    for (const leaked of ["Awa", "Ndiaye", "NDIAYE", "Aminata", "555", "MBR-000001", "Médina", "POL-88412"]) expect(out).not.toContain(leaked);
    expect(out).toContain("[MEMBER]");
    expect(out).toContain("[PATIENT]");
    expect(out).toContain("[PHONE_1]");
    expect(out).toContain("[ADDRESS_1]");
  });

  it("catches details nobody listed: other phones, e-mails, dates, links", () => {
    const r = make();
    const out = r.redact("Mon mari: +221 70 455 88 19, mail khady.s@example.sn, né le 12/03/1985. Lien https://nomad.sn/q/abc123secret ok");
    for (const leaked of ["455", "khady", "12/03/1985", "abc123secret"]) expect(out).not.toContain(leaked);
    expect(out).toMatch(/\[PHONE_\d\]/);
    expect(out).toContain("[EMAIL_1]");
    expect(out).toContain("[DATE_1]");
    expect(out).toContain("[LINK_1]");
  });

  it("doesn't touch ordinary words that contain a name", () => {
    const r = new Redactor().person("MEMBER", "Ali", "Sow");
    expect(r.redact("Sowing salicylate, Ali.")).toBe("Sowing salicylate, [MEMBER].");
  });

  it("leaves medicines, doses and prices alone", () => {
    const r = make();
    expect(r.redact("Paracétamol 500mg x 2 boîtes, total 4 500 FCFA, livraison 45 min")).toBe("Paracétamol 500mg x 2 boîtes, total 4 500 FCFA, livraison 45 min");
  });

  it("puts details back in the answer, with first names for people", () => {
    const r = make();
    r.redact("tel 77 555 01 01, lien https://x.sn/q/tok");
    expect(r.restore("Bonjour [MEMBER], la commande pour [PATIENT] arrive. On vous appelle au [PHONE_1]. Suivi : [LINK_1]")).toBe(
      "Bonjour Awa, la commande pour Aminata arrive. On vous appelle au +221 77 555 01 01. Suivi : https://x.sn/q/tok",
    );
  });

  it("leaves a placeholder the AI made up, so staff notice it", () => {
    expect(make().restore("Bonjour [DOCTOR]")).toBe("Bonjour [DOCTOR]");
  });

  it("the same person twice (member is the patient) is one placeholder", () => {
    const r = new Redactor().person("MEMBER", "Awa", "Ndiaye").person("PATIENT", "Awa", "Ndiaye");
    expect(r.redact("Awa Ndiaye")).toBe("[MEMBER]");
  });
});
