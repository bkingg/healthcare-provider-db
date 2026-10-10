import "server-only";
import { prisma } from "@/lib/prisma";
import { initialRag } from "@/lib/caseRules";
import { medicationLabel, requirementsFor } from "@/lib/medications";
import type { MedicationOrderInput } from "@/lib/validation/medicationOrder";
import type { CurrentMember } from "@/lib/memberAuth";
import { createCaseTx } from "./caseOps";
import { requestablePeople } from "./memberApp";
import { prepareQuotes } from "./pharmacyQuotes";

/** Medication orders placed by members in the app (medication delivery,
 * step 2). Each order is a case of type Medication, so it gets a colour,
 * a response timer and the whole case-management toolkit. */

const catalogSelect = {
  id: true,
  code: true,
  dci: true,
  brandName: true,
  strength: true,
  form: true,
  presentation: true,
  regulatoryClass: true,
  isPsychotropic: true,
  isColdChain: true,
  prescriptionRequired: true,
} as const;

/** The member app's search: every typed word must match the generic,
 * brand or strength ("para 500", "doliprane"). Active items only. */
export async function searchCatalogForMember(q: string) {
  const words = q.trim().split(/\s+/).filter((w) => w.length >= 2).slice(0, 5);
  if (!words.length) return [];
  return prisma.medication.findMany({
    where: {
      isActive: true,
      AND: words.map((w) => ({
        OR: [{ dci: { contains: w, mode: "insensitive" as const } }, { brandName: { contains: w, mode: "insensitive" as const } }, { strength: { contains: w, mode: "insensitive" as const } }],
      })),
    },
    select: catalogSelect,
    orderBy: [{ dci: "asc" }, { strength: "asc" }],
    take: 12,
  });
}

export function activeRequirementRules() {
  return prisma.medicationRequirementRef.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] });
}

/** Problems with the order the form can't see by itself, keyed by the
 * form's sections ("lines", "doc:PRESCRIPTION_PHOTO"…); the codes are
 * translated in the app. Every missing document is reported at once. */
export class OrderRejectedError extends Error {
  public errors: Record<string, string[]>;
  constructor(field: string | Record<string, string[]>, code?: string) {
    super(typeof field === "string" ? (code ?? field) : "rejected");
    this.errors = typeof field === "string" ? { [field]: [code ?? "invalid"] } : field;
  }
}

export async function createMemberMedicationOrder(member: CurrentMember, input: MedicationOrderInput, contactPhone: string) {
  // Who it's for: someone this member can ask for (covered only).
  const people = await requestablePeople(member);
  if (!people.some((p) => p.id === input.patientId)) throw new OrderRejectedError("patientId", "patient");

  const category = await prisma.caseCategoryRef.findFirst({ where: { code: "MEDICATION", isActive: true } });
  if (!category) throw new OrderRejectedError("form", "unavailable");

  // Catalog items must still be active; their details are copied onto the order.
  const ids = input.lines.flatMap((l) => ("medicationId" in l ? [l.medicationId] : []));
  if (new Set(ids).size !== ids.length) throw new OrderRejectedError("lines", "duplicate");
  const meds = await prisma.medication.findMany({ where: { id: { in: ids }, isActive: true }, select: catalogSelect });
  if (meds.length !== ids.length) throw new OrderRejectedError("lines", "itemUnavailable");
  const medById = new Map(meds.map((m) => [m.id, m]));

  // What the items need, by the admin's rules. Free-text items are checked
  // by the pharmacist.
  const rules = await activeRequirementRules();
  const needed = requirementsFor(meds, rules);
  const missing: Record<string, string[]> = {};
  for (const r of needed) {
    if ((r.kind === "UPLOAD" || r.kind === "ID_DOCUMENT") && !input.documents.some((d) => d.requirementCode === r.code)) missing[`doc:${r.code}`] = ["missingDocument"];
    if (r.kind === "ORIGINAL_TO_COLLECT" && !input.acknowledged.includes(r.code)) missing[`doc:${r.code}`] = ["acknowledge"];
  }
  if (Object.keys(missing).length) throw new OrderRejectedError(missing);
  // Only files this member uploaded, not already used on another order, and
  // only for requirements this order has (plus a prescription for free-text items).
  const allowedCodes = new Set([...needed.map((r) => r.code), ...rules.filter((r) => r.appliesTo === "PRESCRIPTION_REQUIRED").map((r) => r.code)]);
  if (input.documents.some((d) => !allowedCodes.has(d.requirementCode))) throw new OrderRejectedError("form", "badDocument");
  const fileIds = input.documents.map((d) => d.fileId);
  if (new Set(fileIds).size !== fileIds.length) throw new OrderRejectedError("form", "badDocument");
  const files = await prisma.storedFile.count({ where: { id: { in: fileIds }, uploadedByMemberId: member.id, medicationDocument: null } });
  if (files !== fileIds.length) throw new OrderRejectedError("form", "badDocument");

  // A delivery address is always given (GPS is optional), so the order
  // never counts as "no location".
  const hasLocation = true;
  const itemsText = input.lines
    .map((l) => ("medicationId" in l ? `${medicationLabel(medById.get(l.medicationId)!)} × ${l.quantity}` : `${l.freeText} × ${l.quantity}`))
    .join("; ");
  const description = [`Medication order: ${itemsText}`, input.note].filter(Boolean).join("\n\n");
  const { rag, reasons } = initialRag({ urgency: input.when, categoryCode: category.code, description, hasLocation });

  return prisma.$transaction(async (tx) => {
    const c = await createCaseTx(
      tx,
      {
        requestedById: member.id,
        patientId: input.patientId,
        categoryId: category.id,
        description,
        contactPhone,
        contactHasWhatsapp: input.contactHasWhatsapp,
        urgency: input.when,
        locationLabel: input.deliveryAddress,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        rag,
        ragReasons: reasons,
        channel: "MEMBER_APP",
      },
      { actorType: "MEMBER", memberId: member.id },
    );
    await tx.medicationOrder.create({
      data: {
        caseId: c.id,
        patientId: input.patientId,
        deliveryAddress: input.deliveryAddress,
        deliveryLatitude: input.latitude ?? null,
        deliveryLongitude: input.longitude ?? null,
        deliveryNotes: input.deliveryNotes || null,
        memberNote: input.note || null,
        needsPrescription: meds.some((m) => m.prescriptionRequired || m.regulatoryClass !== "NOT_LISTED"),
        hasNarcotic: meds.some((m) => m.regulatoryClass === "NARCOTIC"),
        hasPsychotropic: meds.some((m) => m.isPsychotropic),
        hasColdChain: meds.some((m) => m.isColdChain),
        lines: {
          create: input.lines.map((l, i) => {
            if (!("medicationId" in l)) return { freeText: l.freeText, quantity: l.quantity, sortOrder: i };
            const m = medById.get(l.medicationId)!;
            return {
              medicationId: m.id,
              dci: m.dci,
              brandName: m.brandName,
              strength: m.strength,
              form: m.form,
              regulatoryClass: m.regulatoryClass,
              isPsychotropic: m.isPsychotropic,
              isColdChain: m.isColdChain,
              prescriptionRequired: m.prescriptionRequired || m.regulatoryClass !== "NOT_LISTED",
              quantity: l.quantity,
              sortOrder: i,
            };
          }),
        },
        documents: { create: input.documents.map((d) => ({ requirementCode: d.requirementCode, fileId: d.fileId })) },
      },
    });
    return c;
  });
}

/** The order on a case — for the member's request page and the staff case
 * page. Requirement names come from today's rules (codes are kept). */
export function orderForCase(caseId: string) {
  return prisma.medicationOrder.findUnique({
    where: { caseId },
    include: {
      // Today's official price from the catalog, for staff comparing quotes.
      lines: { orderBy: { sortOrder: "asc" }, include: { medication: { select: { officialPriceXof: true } } } },
      documents: { include: { file: { select: { id: true, originalName: true, contentType: true, sizeBytes: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

/** After a new order: pick and prepare the pharmacies to ask (step 3). */
export async function prepareQuotesForCase(caseId: string) {
  const order = await prisma.medicationOrder.findUnique({ where: { caseId }, select: { id: true } });
  if (order) await prepareQuotes(order.id);
}
