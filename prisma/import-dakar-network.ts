/**
 * One-time bulk load of "Provider Network Dakar.ods" (a real-world, messy
 * export the user supplied) into the schema's normal relational shape —
 * Provider + ProviderName + Address + Phone + Email + AdministrativeContact +
 * ProviderProviderType + ProviderSpecialty — rather than through the CSV
 * import pipeline (`src/lib/import/csv.ts`), whose flattened one-row format
 * (single phone, single email, no admin contact, no specialty) can't carry
 * this source's richer per-provider detail without dropping it.
 *
 * The raw sheets were extracted once (unzip + parse content.xml, since no
 * ODS-reading library or LibreOffice was available) into
 * prisma/data/dakar-network-raw.json, committed so this script is
 * reproducible without re-deriving that extraction.
 *
 * Still uses the app's own Import/DQ tables for bookkeeping: one ImportBatch
 * row for the file, a ProviderStaging row per source row (so every row has
 * an audit trail back to its sheet/row number), and DataQualityException
 * rows for the specific standardization judgment calls this script makes
 * (unverified/dead phone numbers flagged by the source itself, missing
 * coordinates, missing contact info) — surfaced in the existing Exceptions
 * screen for a data steward to review, rather than silently dropped.
 *
 * The "hiérarchie des structures publiques de santé au Sénégal" sheet is
 * prose/definitions, not tabular provider data, and is intentionally not
 * imported.
 *
 * Run explicitly: npx tsx prisma/import-dakar-network.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const RAW_PATH = path.join(__dirname, "data/dakar-network-raw.json");
type SheetRows = string[][];
type RawData = Record<string, SheetRows>;

function loadSheet(name: string): { header: string[]; rows: string[][] } {
  const data: RawData = JSON.parse(readFileSync(RAW_PATH, "utf8"));
  const rows = data[name];
  if (!rows) throw new Error(`Sheet not found: ${name}. Available: ${Object.keys(data).join(", ")}`);
  return { header: rows[0], rows: rows.slice(1) };
}

function colIndex(header: string[]): Map<string, number> {
  const idx = new Map<string, number>();
  header.forEach((h, i) => {
    const key = h.trim();
    if (key && !idx.has(key)) idx.set(key, i);
  });
  return idx;
}

function cell(row: string[], idx: Map<string, number>, col: string): string {
  const i = idx.get(col);
  if (i === undefined) return "";
  return (row[i] ?? "").trim();
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

const SENEGAL_BBOX = { minLat: 12, maxLat: 17, minLon: -18, maxLon: -11 };

function parseCoordinates(raw: string): { latitude: number; longitude: number } | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [latitude, longitude] = parts;
  return { latitude, longitude };
}

function coordinatesInBounds(lat: number, lon: number): boolean {
  return lat >= SENEGAL_BBOX.minLat && lat <= SENEGAL_BBOX.maxLat && lon >= SENEGAL_BBOX.minLon && lon <= SENEGAL_BBOX.maxLon;
}

type ParsedPhone = { raw: string; formatted: string; note: string | null; suspect: boolean };

/** Splits a raw phone cell into individual numbers, stripping the source's own
 * confidence annotations ("OK", "NI: Numéro Inexistant", "PE: Pas Encore") and
 * folding them into a note + suspect flag instead of losing them. */
function parsePhones(raw: string): ParsedPhone[] {
  if (!raw) return [];
  const segments = raw
    .split(/[/\n]|(?<=\d)\s{2,}(?=\d)/)
    .map((s) => s.trim())
    .filter(Boolean);

  return segments.map((segment) => {
    let note: string | null = null;
    let suspect = false;
    let text = segment;

    if (/\bNI\b/.test(text)) {
      note = "Flagged by source as unreachable/nonexistent (NI)";
      suspect = true;
      text = text.replace(/\bNI\b:?/g, "");
    } else if (/\bPE\b/.test(text)) {
      note = "Flagged by source as not yet confirmed (PE)";
      suspect = true;
      text = text.replace(/\bPE\b:?/g, "");
    } else if (/\bOK\b/.test(text)) {
      text = text.replace(/\bOK\b/g, "");
    }

    const digits = text.replace(/\D/g, "");
    let formatted = text.trim();
    if (digits.length === 9) {
      formatted = `+221 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
    } else if (digits.length === 12 && digits.startsWith("221")) {
      formatted = `+221 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
    } else if (digits.length > 0) {
      suspect = suspect || digits.length < 9;
      formatted = text.trim();
    }

    return { raw: segment, formatted, note, suspect };
  });
}

/** Splits a raw email cell (sometimes multiple addresses joined by "///", "/",
 * "," or ";") and keeps only tokens that look like a real email address. */
function parseEmails(raw: string): { valid: string[]; invalidRaw: string[] } {
  if (!raw) return { valid: [], invalidRaw: [] };
  const tokens = raw
    .split(/\/\/\/|\/|,|;/)
    .map((t) => t.trim())
    .filter(Boolean);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = tokens.filter((t) => emailRe.test(t));
  const invalidRaw = tokens.filter((t) => !emailRe.test(t));
  return { valid, invalidRaw };
}

function titleCaseCity(raw: string): string {
  if (!raw) return "Dakar";
  if (/^fufisque$/i.test(raw)) return "Rufisque"; // consistent source typo
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const systemUser = await prisma.user.upsert({
    where: { email: "system@seed.local" },
    update: {},
    create: { email: "system@seed.local", name: "Seed System User" },
  });

  const senegal = await prisma.countryRef.findUniqueOrThrow({ where: { iso2: "SN" } });
  const physicalAddress = await prisma.addressTypeRef.findUniqueOrThrow({ where: { code: "PHYSICAL" } });
  const mainPhoneType = await prisma.phoneTypeRef.findUniqueOrThrow({ where: { code: "MAIN" } });
  const mainEmailType = await prisma.emailTypeRef.findUniqueOrThrow({ where: { code: "MAIN" } });
  const adminEmailType = await prisma.emailTypeRef.findUniqueOrThrow({ where: { code: "ADMIN" } });

  const mobilePhoneType = await prisma.phoneTypeRef.upsert({
    where: { code: "MOBILE" },
    update: {},
    create: { code: "MOBILE", name: "Mobile" },
  });

  const facilityCategory = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "FACILITY" } });
  const hospitalType = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "HOSPITAL" } });
  const clinicType = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "CLINIC" } });
  const physicianType = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "PHYSICIAN" } });

  const pharmacyType = await prisma.providerTypeRef.upsert({
    where: { code: "PHARMACY" },
    update: {},
    create: { code: "PHARMACY", nameEn: "Pharmacy", nameFr: "Pharmacie", level: "TYPE", parentId: facilityCategory.id, sortOrder: 3 },
  });
  const healthCenterType = await prisma.providerTypeRef.upsert({
    where: { code: "HEALTH_CENTER" },
    update: {},
    create: { code: "HEALTH_CENTER", nameEn: "Health Center", nameFr: "Centre de santé", level: "TYPE", parentId: facilityCategory.id, sortOrder: 4 },
  });
  const diagnosticCenterType = await prisma.providerTypeRef.upsert({
    where: { code: "DIAGNOSTIC_CENTER" },
    update: {},
    create: { code: "DIAGNOSTIC_CENTER", nameEn: "Diagnostic Center", nameFr: "Centre de diagnostic", level: "TYPE", parentId: facilityCategory.id, sortOrder: 5 },
  });

  const specialtyDefs = [
    { code: "GASTROENTEROLOGY", nameEn: "Gastroenterology", nameFr: "Gastro-entérologie" },
    { code: "PULMONOLOGY", nameEn: "Pulmonology", nameFr: "Pneumologie" },
    { code: "PSYCHIATRY", nameEn: "Psychiatry", nameFr: "Psychiatrie" },
  ];
  for (const s of specialtyDefs) {
    await prisma.specialty.upsert({ where: { code: s.code }, update: {}, create: s });
  }
  const specialty = async (code: string) => prisma.specialty.findUniqueOrThrow({ where: { code } });

  const unverifiedPhoneRule = await prisma.dqRuleRef.upsert({
    where: { code: "UNVERIFIED_PHONE_NUMBER" },
    update: {},
    create: {
      code: "UNVERIFIED_PHONE_NUMBER",
      description: "Phone number flagged by the source data itself as unreachable or unconfirmed",
      defaultSeverity: "WARNING",
    },
  });
  const invalidCoordinatesRule = await prisma.dqRuleRef.findUniqueOrThrow({ where: { code: "INVALID_COORDINATES" } });
  const missingContactRule = await prisma.dqRuleRef.findUniqueOrThrow({ where: { code: "MISSING_CONTACT_OR_LOCATION" } });
  const invalidEmailRule = await prisma.dqRuleRef.findUniqueOrThrow({ where: { code: "INVALID_EMAIL_FORMAT" } });

  const importBatch = await prisma.importBatch.create({
    data: {
      fileName: "Provider Network Dakar.ods",
      loadedById: systemUser.id,
      status: "VALIDATING",
      notes:
        "Bulk-loaded via prisma/import-dakar-network.ts from a user-supplied .ods export. " +
        "Sheet 'hiérarchie des structures publiques de santé au Sénégal' excluded (prose, not tabular data).",
    },
  });

  let totalRecordCount = 0;
  let stagedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let exceptionCount = 0;

  const SPECIALTY_MAP: Record<string, string> = {
    "chirurgies orthopediques": "ORTHOPEDICS",
    orl: "ENT",
    "chirurgien cervo-faciale": "ENT",
    radiologie: "RADIOLOGY",
    gastroenterologie: "GASTROENTEROLOGY",
    "gynecologie,": "MATERNITY",
    gynecologie: "MATERNITY",
    orthoptistes: "OPHTHALMOLOGY",
    pneumopysiologies: "PULMONOLOGY",
    psychatrie: "PSYCHIATRY",
    "psychiatre épilepsie eeg": "PSYCHIATRY",
    "psychiatrie légale et neuro-pathologies,psychiatrie générale": "PSYCHIATRY",
    "chirurgien vasculaire": "GENERAL_SURGERY",
  };

  type NamePlan = {
    facilityName?: string;
    firstName?: string;
    lastName?: string;
    fullNameText: string;
  };

  type ProviderPlan = {
    externalId: string;
    name: NamePlan;
    typeId: string;
    specialtyCode?: string;
    line1?: string;
    line2?: string;
    city?: string;
    coords?: { latitude: number; longitude: number } | null;
    coordsRaw?: string;
    phones: { number: string; typeId: string; note: string | null; suspect: boolean; raw: string }[];
    emails: string[];
    invalidEmailRaw: string[];
    profileSummary?: string;
    externalNotes?: string;
    internalNotes?: string;
    adminContact?: { firstName: string; lastName: string; jobTitle: string };
    sourceRow: string[];
    sourceSheet: string;
    rowNumber: number;
  };

  async function commitPlan(plan: ProviderPlan) {
    const hasContact = plan.phones.length > 0 || plan.emails.length > 0 || Boolean(plan.line1);

    const provider = await prisma.provider.upsert({
      where: { externalId: plan.externalId },
      update: {},
      create: {
        countryId: senegal.id,
        status: "PENDING_REVIEW",
        operatingStatus: "UNKNOWN",
        externalId: plan.externalId,
        createdBy: systemUser.id,
        updatedById: systemUser.id,
        profileSummary: plan.profileSummary,
        externalNotes: plan.externalNotes,
        internalNotes: plan.internalNotes,
        providerTypes: { create: { providerTypeId: plan.typeId, isPrimary: true } },
        names: {
          create: {
            nameType: "LEGAL",
            facilityName: plan.name.facilityName,
            individualFirstName: plan.name.firstName,
            individualLastName: plan.name.lastName,
            fullNameText: plan.name.fullNameText,
            isPrimary: true,
          },
        },
        addresses: plan.line1
          ? {
              create: {
                addressTypeId: physicalAddress.id,
                line1: plan.line1,
                line2: plan.line2 || undefined,
                city: plan.city || "Dakar",
                countryId: senegal.id,
                latitude: plan.coords?.latitude,
                longitude: plan.coords?.longitude,
                coordinateStatus: plan.coords ? "CONFIRMED" : "MISSING",
                isPrimary: true,
              },
            }
          : undefined,
        phones: plan.phones.length
          ? { create: plan.phones.map((p) => ({ phoneTypeId: p.typeId, number: p.number, notes: p.note ?? undefined, isActive: !p.suspect })) }
          : undefined,
        emails: plan.emails.length
          ? {
              create: plan.emails.map((address, i) => ({
                emailTypeId: i === 0 ? mainEmailType.id : adminEmailType.id,
                address,
              })),
            }
          : undefined,
        specialties: plan.specialtyCode ? { create: { specialtyId: (await specialty(plan.specialtyCode)).id, isPrimary: true } } : undefined,
        administrativeContacts: plan.adminContact
          ? {
              create: {
                firstName: plan.adminContact.firstName,
                lastName: plan.adminContact.lastName,
                jobTitle: plan.adminContact.jobTitle,
              },
            }
          : undefined,
      },
    });

    const staging = await prisma.providerStaging.create({
      data: {
        importBatchId: importBatch.id,
        rowNumber: plan.rowNumber,
        rawProviderName: plan.name.fullNameText,
        rawCountryCode: "SN",
        rawCity: plan.city,
        rawAddressLine1: plan.line1,
        rawPhone: plan.phones[0]?.number,
        rawLatitude: plan.coords ? String(plan.coords.latitude) : undefined,
        rawLongitude: plan.coords ? String(plan.coords.longitude) : undefined,
        rawExternalId: plan.externalId,
        matchedProviderId: provider.id,
        validationStatus: "COMMITTED",
      },
    });
    stagedCount += 1;
    approvedCount += 1;

    if (!hasContact) {
      await prisma.dataQualityException.create({
        data: {
          importBatchId: importBatch.id,
          stagingRowId: staging.id,
          providerId: provider.id,
          fieldName: "contact",
          ruleId: missingContactRule.id,
          severity: "WARNING",
        },
      });
      exceptionCount += 1;
    }
    if (plan.coordsRaw && !plan.coords) {
      await prisma.dataQualityException.create({
        data: {
          importBatchId: importBatch.id,
          stagingRowId: staging.id,
          providerId: provider.id,
          fieldName: "address.coordinates",
          fieldValue: plan.coordsRaw,
          ruleId: invalidCoordinatesRule.id,
          severity: "WARNING",
        },
      });
      exceptionCount += 1;
    }
    for (const p of plan.phones) {
      if (p.suspect) {
        await prisma.dataQualityException.create({
          data: {
            importBatchId: importBatch.id,
            stagingRowId: staging.id,
            providerId: provider.id,
            fieldName: "phone.number",
            fieldValue: p.raw,
            ruleId: unverifiedPhoneRule.id,
            severity: "WARNING",
          },
        });
        exceptionCount += 1;
      }
    }
    for (const bad of plan.invalidEmailRaw) {
      await prisma.dataQualityException.create({
        data: {
          importBatchId: importBatch.id,
          stagingRowId: staging.id,
          providerId: provider.id,
          fieldName: "email.address",
          fieldValue: bad,
          ruleId: invalidEmailRule.id,
          severity: "WARNING",
        },
      });
      exceptionCount += 1;
    }

    return provider;
  }

  // -------------------------------------------------------------------------
  // Sheet 1: "Structures de Santé " — facilities first (so physicians below
  // can be affiliated to a facility created in this same run), then everyone
  // else.
  // -------------------------------------------------------------------------
  const mainSheet = loadSheet("Structures de Santé ");
  const idx = colIndex(mainSheet.header);
  const g = (row: string[], col: string) => cell(row, idx, col);

  const FACILITY_TYPE_BY_PRESTATAIRE: Record<string, string> = {
    pharmacie: pharmacyType.id,
    hôpital: hospitalType.id,
    "centre de santé": healthCenterType.id,
    clinique: clinicType.id,
    radiologie: diagnosticCenterType.id,
  };

  /** Four cases, in priority order:
   * 1. Prestataire names a facility keyword (pharmacie/hôpital/clinique/...) -> facility, First/Last ignored.
   * 2. Prestataire is explicitly "Docteur" -> physician, even if Facility Name is also set (their workplace).
   * 3. No Facility Name, but a person name is present -> physician.
   * 4. Facility Name present (Prestataire blank) and First Name is a genuinely different
   *    value (not just the facility name duplicated into that column) -> physician
   *    practicing under a named cabinet (e.g. "Cabinet Médical ORL" + "Mouhamadou DIENG").
   * Anything else with a Facility Name and no distinguishing person -> facility. */
  function classify(row: string[]): "facility" | "physician" {
    const facilityName = g(row, "Facility Name");
    const firstName = g(row, "First Name");
    const lastName = g(row, "Last Name");
    const prestataire = g(row, "Prestataire").toLowerCase();

    if (prestataire in FACILITY_TYPE_BY_PRESTATAIRE) return "facility";
    if (prestataire === "docteur") return "physician";
    if (!facilityName) return firstName || lastName ? "physician" : "facility";
    if (firstName && firstName !== facilityName) return "physician";
    return "facility";
  }

  const facilityProvidersByName = new Map<string, { id: string }>();
  const physicianRows: { row: string[]; rowNumber: number }[] = [];

  mainSheet.rows.forEach((row, i) => {
    totalRecordCount += 1;
    const rowNumber = i + 2; // +1 header, +1 1-indexed
    if (classify(row) === "physician") physicianRows.push({ row, rowNumber });
  });

  for (let i = 0; i < mainSheet.rows.length; i++) {
    const row = mainSheet.rows[i];
    const rowNumber = i + 2;
    const facilityName = g(row, "Facility Name");
    const prestataire = g(row, "Prestataire").toLowerCase();
    if (classify(row) === "physician") continue; // second pass

    if (!facilityName) continue; // nothing usable as a facility row

    let typeId = FACILITY_TYPE_BY_PRESTATAIRE[prestataire];
    if (!typeId) {
      const specialite = g(row, "Specialité").toLowerCase();
      typeId = specialite === "radiologie" ? diagnosticCenterType.id : healthCenterType.id;
    }

    const coordsRaw = g(row, "Coordonnees");
    const coords = parseCoordinates(coordsRaw);
    const validCoords = coords && coordinatesInBounds(coords.latitude, coords.longitude) ? coords : null;

    const phones: ProviderPlan["phones"] = [];
    for (const p of parsePhones(g(row, "Cell"))) phones.push({ number: p.formatted, typeId: mobilePhoneType.id, note: p.note, suspect: p.suspect, raw: p.raw });
    for (const p of parsePhones(g(row, "Fixe"))) phones.push({ number: p.formatted, typeId: mainPhoneType.id, note: p.note, suspect: p.suspect, raw: p.raw });

    const { valid: emails, invalidRaw: invalidEmailRaw } = parseEmails(g(row, "Email"));

    const notesParts: string[] = [];
    const transport = g(row, "MOYENS DE TRANSPORT/ BUS");
    const hours = g(row, "HORAIRES");
    if (transport) notesParts.push(`Transport: ${transport}`);
    if (hours) notesParts.push(`Horaires: ${hours}`);
    notesParts.push(`Source: Provider Network Dakar.ods, sheet "Structures de Santé", row ${rowNumber}`);

    const specialite = g(row, "Specialité").toLowerCase();
    const specialtyCode = SPECIALTY_MAP[specialite];

    const plan: ProviderPlan = {
      externalId: `DAKAR-ODS-MAIN-${rowNumber}`,
      name: { facilityName, fullNameText: facilityName },
      typeId,
      specialtyCode,
      line1: g(row, "Adresse 1") || undefined,
      line2: g(row, "Adresse 2") || undefined,
      city: titleCaseCity(g(row, "Ville")),
      coords: validCoords,
      coordsRaw: coordsRaw || undefined,
      phones,
      emails,
      invalidEmailRaw,
      profileSummary: g(row, "Services") || undefined,
      externalNotes: g(row, "HISTORIQUE DES HOPITAUX") || undefined,
      internalNotes: notesParts.join(" | "),
      sourceRow: row,
      sourceSheet: "Structures de Santé",
      rowNumber,
    };

    const provider = await commitPlan(plan);
    facilityProvidersByName.set(facilityName, provider);
  }

  const staffPhysicianType = await prisma.affiliationTypeRef.upsert({
    where: { code: "STAFF_PHYSICIAN" },
    update: {},
    create: { code: "STAFF_PHYSICIAN", name: "Staff Physician", description: "Physician on staff at this facility" },
  });

  for (const { row, rowNumber } of physicianRows) {
    let firstName = g(row, "First Name") || "Unknown";
    let lastName = g(row, "Last Name") || "";
    // Some rows jam a full name into First Name with Last Name left blank
    // (e.g. facility-name-shaped rows that turned out to name a person) —
    // split on the last space so individualFirstName/individualLastName
    // aren't just one giant string in the first-name column.
    if (!lastName && firstName.includes(" ")) {
      const parts = firstName.trim().split(/\s+/);
      lastName = parts.pop()!;
      firstName = parts.join(" ");
    }
    const facilityName = g(row, "Facility Name");
    const fullNameText = facilityName && facilityName !== g(row, "First Name") ? `${facilityName} — Dr ${firstName} ${lastName}`.trim() : `Dr ${firstName} ${lastName}`.trim();

    const coordsRaw = "";
    const phones: ProviderPlan["phones"] = [];
    for (const p of parsePhones(g(row, "Cell"))) phones.push({ number: p.formatted, typeId: mobilePhoneType.id, note: p.note, suspect: p.suspect, raw: p.raw });
    for (const p of parsePhones(g(row, "Fixe"))) phones.push({ number: p.formatted, typeId: mainPhoneType.id, note: p.note, suspect: p.suspect, raw: p.raw });

    const { valid: emails, invalidRaw: invalidEmailRaw } = parseEmails(g(row, "Email"));
    const specialite = g(row, "Specialité").toLowerCase();
    const specialtyCode = SPECIALTY_MAP[specialite];

    const notesParts = [`Source: Provider Network Dakar.ods, sheet "Structures de Santé", row ${rowNumber}`];
    if (facilityName && !facilityProvidersByName.has(facilityName)) {
      notesParts.unshift(`Affiliated facility per source (not present as a separate record in this dataset): ${facilityName}`);
    }

    const plan: ProviderPlan = {
      externalId: `DAKAR-ODS-MAIN-${rowNumber}`,
      name: { firstName, lastName, fullNameText },
      typeId: physicianType.id,
      specialtyCode,
      line1: g(row, "Adresse 1") || undefined,
      line2: g(row, "Adresse 2") || undefined,
      city: titleCaseCity(g(row, "Ville")),
      coords: null,
      coordsRaw,
      phones,
      emails,
      invalidEmailRaw,
      internalNotes: notesParts.join(" | "),
      sourceRow: row,
      sourceSheet: "Structures de Santé",
      rowNumber,
    };

    const provider = await commitPlan(plan);

    const facility = facilityName ? facilityProvidersByName.get(facilityName) : undefined;
    if (facility) {
      const existing = await prisma.affiliation.findFirst({
        where: { providerId: provider.id, relatedProviderId: facility.id, affiliationTypeId: staffPhysicianType.id },
        select: { id: true },
      });
      if (!existing) {
        await prisma.affiliation.create({
          data: {
            providerId: provider.id,
            relatedProviderId: facility.id,
            affiliationTypeId: staffPhysicianType.id,
            createdBy: systemUser.id,
            updatedBy: systemUser.id,
          },
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Sheet 2: "Pharmacies CMU" — every row is a pharmacy; the pharmacist named
  // in PHARMACIENS becomes an AdministrativeContact, not a separate Provider.
  // -------------------------------------------------------------------------
  const cmuSheet = loadSheet("Pharmacies CMU");
  const cmuIdx = colIndex(cmuSheet.header);
  const gc = (row: string[], col: string) => cell(row, cmuIdx, col);

  for (let i = 0; i < cmuSheet.rows.length; i++) {
    const row = cmuSheet.rows[i];
    if (row.every((c) => !c)) continue; // fully blank row
    totalRecordCount += 1;
    const rowNumber = i + 2;

    const name = gc(row, "NOMS PHARMACIES");
    if (!name) {
      rejectedCount += 1;
      continue;
    }

    const pharmacienRaw = gc(row, "PHARMACIENS").replace(/\n/g, " ").trim();
    let adminContact: ProviderPlan["adminContact"];
    if (pharmacienRaw) {
      const cleaned = pharmacienRaw.replace(/^Dr\.?\s+/i, "").split("/")[0].trim();
      const parts = cleaned.split(/\s+/);
      adminContact = {
        firstName: parts.slice(0, -1).join(" ") || parts[0] || cleaned,
        lastName: parts.length > 1 ? parts[parts.length - 1] : "",
        jobTitle: "Pharmacist in Charge",
      };
    }

    const coordsRaw = gc(row, "COORDONNÉES");
    const coords = parseCoordinates(coordsRaw);
    const validCoords = coords && coordinatesInBounds(coords.latitude, coords.longitude) ? coords : null;

    const phones = parsePhones(gc(row, "TÉLÉPHONES")).map((p) => ({ number: p.formatted, typeId: mainPhoneType.id, note: p.note, suspect: p.suspect, raw: p.raw }));
    const { valid: emails, invalidRaw: invalidEmailRaw } = parseEmails(gc(row, "EMAILS"));

    const notesParts: string[] = [];
    const transport = gc(row, "MOYENS DE TRANSPORT");
    const hours = gc(row, "HORAIRES");
    const days = gc(row, "JOURS");
    const targeted = gc(row, "STRUCTURES DE SANTÉ CIBLÉES");
    const comments = gc(row, "BASE ET COMMENTAIRES");
    if (transport) notesParts.push(`Transport: ${transport}`);
    if (hours) notesParts.push(`Horaires: ${hours}`);
    if (days) notesParts.push(`Jours: ${days}`);
    if (targeted) notesParts.push(`Structure de santé ciblée: ${targeted}`);
    if (comments) notesParts.push(`Commentaire: ${comments}`);
    notesParts.push(`Source: Provider Network Dakar.ods, sheet "Pharmacies CMU", row ${rowNumber}`);

    const plan: ProviderPlan = {
      externalId: `DAKAR-ODS-CMU-${rowNumber}`,
      name: { facilityName: name, fullNameText: name },
      typeId: pharmacyType.id,
      line1: gc(row, "ADRESSES1") || undefined,
      city: titleCaseCity(gc(row, "DÉPARTEMENTS")),
      coords: validCoords,
      coordsRaw: coordsRaw || undefined,
      phones,
      emails,
      invalidEmailRaw,
      externalNotes: gc(row, "Carte CMU+Ordonnance+Bon de commande") ? "Accepts: Carte CMU + Ordonnance + Bon de commande" : undefined,
      internalNotes: notesParts.join(" | "),
      adminContact,
      sourceRow: row,
      sourceSheet: "Pharmacies CMU",
      rowNumber,
    };

    await commitPlan(plan);
  }

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      totalRecordCount,
      stagedCount,
      approvedCount,
      rejectedCount,
      exceptionCount,
      status: "RECONCILED",
      reconciledAt: new Date(),
    },
  });

  console.log("Dakar network import complete:", { totalRecordCount, stagedCount, approvedCount, rejectedCount, exceptionCount });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
