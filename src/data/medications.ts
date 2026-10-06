import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import { needsPrescription, type RegulatoryClass } from "@/lib/medications";
import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "./audit";

/** The medication catalog (medication delivery, step 1): admin search and
 * editing. Bulk loading is in medicationImport.ts. */

export type CatalogFilters = {
  q?: string;
  regulatoryClass?: RegulatoryClass;
  coldChain?: boolean;
  psychotropic?: boolean;
  status: "ACTIVE" | "INACTIVE" | "ALL";
  sample?: "ONLY" | "HIDE";
};

const PAGE = 200;

/** Every typed word must match the generic, brand, strength, form or code —
 * "para 500", "doliprane", "LNMPE-195". */
export async function searchMedications(f: CatalogFilters) {
  const words = (f.q ?? "").trim().split(/\s+/).filter(Boolean);
  const where: Prisma.MedicationWhereInput = {
    ...(f.status !== "ALL" && { isActive: f.status === "ACTIVE" }),
    ...(f.regulatoryClass && { regulatoryClass: f.regulatoryClass }),
    ...(f.coldChain && { isColdChain: true }),
    ...(f.psychotropic && { isPsychotropic: true }),
    ...(f.sample === "ONLY" && { isSample: true }),
    ...(f.sample === "HIDE" && { isSample: false }),
    AND: words.map((w) => ({
      OR: [
        { dci: { contains: w, mode: "insensitive" as const } },
        { brandName: { contains: w, mode: "insensitive" as const } },
        { strength: { contains: w, mode: "insensitive" as const } },
        { form: { contains: w, mode: "insensitive" as const } },
        { code: { contains: w, mode: "insensitive" as const } },
      ],
    })),
  };
  const [items, total, samples] = await Promise.all([
    prisma.medication.findMany({ where, orderBy: [{ dci: "asc" }, { strength: "asc" }], take: PAGE }),
    prisma.medication.count({ where }),
    prisma.medication.count({ where: { isSample: true } }),
  ]);
  return { items, total, limit: PAGE, samples };
}

export type MedicationFormInput = {
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
};

function toData(i: MedicationFormInput) {
  return { ...i, prescriptionRequired: needsPrescription(i) };
}

export async function createMedication(input: MedicationFormInput, actorId: string) {
  const m = await prisma.medication.create({ data: { ...toData(input), createdBy: actorId, updatedBy: actorId } });
  await writeAudit({ entityType: "Medication", entityId: m.id, action: AuditAction.CREATE, actorId });
  return m;
}

/** One audit row per changed field, like provider and member edits. An item
 * edited by hand is no longer sample data. */
export async function updateMedication(id: string, input: MedicationFormInput, actorId: string) {
  const before = await prisma.medication.findUniqueOrThrow({ where: { id } });
  const data = toData(input);
  const m = await prisma.medication.update({ where: { id }, data: { ...data, isSample: false, updatedBy: actorId } });
  for (const [field, value] of Object.entries(data)) {
    const prev = before[field as keyof typeof before];
    if (String(prev ?? "") !== String(value ?? "")) {
      await writeAudit({ entityType: "Medication", entityId: id, action: AuditAction.UPDATE, actorId, fieldName: field, previousValue: prev === null ? null : String(prev), newValue: value === null ? null : String(value) });
    }
  }
  return m;
}

export async function setMedicationActive(id: string, isActive: boolean, actorId: string) {
  await prisma.medication.update({ where: { id }, data: { isActive, updatedBy: actorId } });
  await writeAudit({ entityType: "Medication", entityId: id, action: AuditAction.UPDATE, actorId, fieldName: "isActive", newValue: String(isActive) });
}
