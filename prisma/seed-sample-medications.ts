/**
 * Sample medication catalog for testing medication delivery (step 1).
 *
 *   npm run db:seed-sample-medications            load / refresh the sample
 *   npm run db:seed-sample-medications -- --remove remove every sample item
 *
 * The rows in prisma/data/sample-medications.csv are copied from Senegal's
 * Liste Nationale des Médicaments et Produits Essentiels (LNMPE, 2022
 * revision, ARP) — generic name, dosage, form and reference brand. The
 * regulatory class, psychotropic and cold-chain flags are NOT in the LNMPE:
 * they're suggestions for Nomad's pharmacist to check. Codes start with
 * SAMPLE- so they never clash with a real import, and the items are marked
 * as sample (shown with a SAMPLE tag in Admin > Medication catalog).
 * Loaded through the same checks as the admin import.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { checkMedicationRows, normalizeMedicationHeader, summarizeMedications, type MedicationInput, type RawMedicationRow } from "../src/lib/import/medicationImport";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  if (process.argv.includes("--remove")) {
    const { count } = await prisma.medication.deleteMany({ where: { isSample: true } });
    console.log(`Removed ${count} sample medications.`);
    return;
  }
  const csv = readFileSync(join(__dirname, "data", "sample-medications.csv"), "utf8");
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy", transformHeader: normalizeMedicationHeader });
  const rows = parsed.data as RawMedicationRow[];
  const existing = new Map<string, MedicationInput>(
    (await prisma.medication.findMany()).map((m) => [m.code, { ...m, sourceCheckedOn: m.sourceCheckedOn?.toISOString().slice(0, 10) ?? null }]),
  );
  const checked = checkMedicationRows(rows, existing);
  const bad = checked.filter((r) => r.errors.length);
  if (bad.length) throw new Error(`Sample file has errors: ${bad.map((r) => `row ${r.rowNumber}: ${r.errors.join("; ")}`).join(" | ")}`);
  for (const r of checked) {
    if (r.action === "UNCHANGED") continue;
    const { code, sourceCheckedOn, ...rest } = r.input!;
    const data = { ...rest, sourceCheckedOn: sourceCheckedOn ? new Date(`${sourceCheckedOn}T00:00:00Z`) : null };
    await prisma.medication.upsert({ where: { code }, create: { code, ...data, isSample: true }, update: { ...data, isSample: true } });
  }
  console.log("Sample medications:", summarizeMedications(checked));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
