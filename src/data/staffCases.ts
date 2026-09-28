import "server-only";
import { prisma } from "@/lib/prisma";
import { initialRag, type Rag } from "@/lib/caseRules";
import { parseMemberNumber } from "@/lib/memberNumber";
import { AuditAction } from "@/lib/enums";
import { formatCaseNumber } from "@/lib/caseNumber";
import type { StaffCaseInput } from "@/lib/validation/staffCase";
import type { CaseCoverage, Prisma } from "../../generated/prisma/client";
import { createCaseTx, dueFor } from "./caseOps";
import { addActionTx, recordMentionsTx } from "./caseActions";
import { writeAudit } from "./audit";

/** Cases opened by staff — when a member phones, emails, sends a WhatsApp or
 * walks in — and special requests (help for someone not covered, or outside
 * cover, free or at a set cost). */

type Tx = Prisma.TransactionClient;

/** A check the form can't do alone; the field it belongs to and a message
 * code the screen translates (Cases.newCase.error.*). */
export class StaffCaseError extends Error {
  constructor(
    public field: string,
    public code: string,
  ) {
    super(code);
  }
}

const personSelect = { id: true, firstName: true, lastName: true, memberNumber: true, dateOfBirth: true, isCovered: true, phone: true, email: true } as const;

/** Members matching what staff typed (name, member ID, phone, email), each
 * with their active household — to pick who got in touch and who the help
 * is for. Active members only. */
export async function findMembersForCase(q: string) {
  const query = q.trim();
  if (query.length < 2) return [];
  const memberNumber = parseMemberNumber(query);
  const digits = query.replace(/\D/g, "");
  const words = query.split(/\s+/).filter(Boolean);
  const matches = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        ...(memberNumber !== null ? [{ memberNumber }] : []),
        { email: { contains: query, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        { AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }] })) },
      ],
    },
    select: { ...personSelect, primaryMemberId: true, organization: { select: { name: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 8,
  });
  const primaryIds = [...new Set(matches.map((m) => m.primaryMemberId ?? m.id))];
  const households = await prisma.member.findMany({
    where: { status: "ACTIVE", OR: [{ id: { in: primaryIds } }, { primaryMemberId: { in: primaryIds } }] },
    select: { ...personSelect, primaryMemberId: true, relationship: { select: { nameEn: true, nameFr: true } } },
    orderBy: [{ primaryMemberId: { sort: "asc", nulls: "first" } }, { dateOfBirth: "asc" }],
  });
  return matches.map((m) => {
    const primaryId = m.primaryMemberId ?? m.id;
    return { ...m, household: households.filter((h) => h.id === primaryId || h.primaryMemberId === primaryId) };
  });
}

/** Someone who isn't in the member list yet, added from the New case form
 * with just the essentials (case managers can't open the Members screens). */
async function addPersonTx(tx: Tx, p: NonNullable<StaffCaseInput["newPerson"]>, staffId: string) {
  if (p.email && (await tx.member.findUnique({ where: { email: p.email }, select: { id: true } }))) {
    throw new StaffCaseError("newPerson.email", "emailTaken");
  }
  return tx.member.create({
    data: {
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      preferredLanguage: p.preferredLanguage,
      countryId: p.countryId ?? null,
      isCovered: p.isCovered,
      createdBy: staffId,
      updatedBy: staffId,
    },
  });
}

export async function createStaffCase(input: StaffCaseInput, staffId: string) {
  const category = await prisma.caseCategoryRef.findFirst({ where: { id: input.categoryId, isActive: true } });
  if (!category) throw new StaffCaseError("categoryId", "category");

  const created = await prisma.$transaction(async (tx) => {
    // Who got in touch: an existing active member, or someone added now.
    const requester = input.newPerson
      ? await addPersonTx(tx, input.newPerson, staffId)
      : await tx.member.findFirst({ where: { id: input.requesterId, status: "ACTIVE" } });
    if (!requester) throw new StaffCaseError("requesterId", "requester");

    // Who the help is for: anyone active in the same household.
    const householdId = requester.primaryMemberId ?? requester.id;
    const patientId = input.newPerson || !input.patientId ? requester.id : input.patientId;
    const patient = await tx.member.findFirst({ where: { id: patientId, status: "ACTIVE", OR: [{ id: householdId }, { primaryMemberId: householdId }] } });
    if (!patient) throw new StaffCaseError("patientId", "patient");
    // Someone not covered can only be helped as a special request.
    if (!patient.isCovered && input.coverage === "COVERED") throw new StaffCaseError("coverage", "notCovered");

    if (input.assigneeId) {
      const worker = await tx.user.findFirst({ where: { id: input.assigneeId, isActive: true, role: { canWorkCases: true, isActive: true } }, select: { id: true } });
      if (!worker) throw new StaffCaseError("assigneeId", "assignee");
    }

    const hasLocation = Boolean(input.locationLabel);
    const suggested = initialRag({ urgency: input.urgency, categoryCode: category.code, description: input.description, hasLocation });
    const c = await createCaseTx(
      tx,
      {
        requestedById: requester.id,
        patientId: patient.id,
        categoryId: category.id,
        description: input.description,
        contactPhone: input.contactPhone,
        contactHasWhatsapp: input.contactHasWhatsapp,
        urgency: input.urgency,
        locationLabel: input.locationLabel ?? null,
        rag: suggested.rag,
        ragReasons: suggested.reasons,
        channel: input.channel,
        coverage: input.coverage,
        contactedAt: input.contactedAt,
        visibleToMember: input.visibleToMember,
        assignedToId: input.assigneeId ?? null,
      },
      { actorType: "STAFF", staffId },
    );

    // A colour chosen by staff instead of the rules' suggestion, with why.
    if (input.colour && input.colour.rag !== suggested.rag && !input.colour.reason) throw new StaffCaseError("colourReason", "reasonRequired");
    if (input.colour && input.colour.rag !== suggested.rag) {
      await tx.careCase.update({
        where: { id: c.id },
        data: { rag: input.colour.rag, ragOverridden: true, ragReasons: ["STAFF_OVERRIDE"], responseDueAt: await dueFor(input.colour.rag as Rag, input.contactedAt, tx) },
      });
      await tx.caseEvent.create({ data: { caseId: c.id, type: "COLOUR_OVERRIDDEN", actorType: "STAFF", staffId, body: input.colour.reason, data: { from: suggested.rag, to: input.colour.rag } } });
    }

    // Already being handled (e.g. on the phone now): the response timer stops.
    if (input.status === "IN_PROGRESS") {
      await tx.careCase.update({ where: { id: c.id }, data: { status: "IN_PROGRESS", responseDueAt: null } });
      await tx.caseEvent.create({ data: { caseId: c.id, type: "STATUS_CHANGED", actorType: "STAFF", staffId, data: { from: "NEW", to: "IN_PROGRESS" } } });
    }
    if (input.assigneeId) {
      await tx.caseEvent.create({ data: { caseId: c.id, type: "ASSIGNED", actorType: "STAFF", staffId, data: { from: null, to: input.assigneeId } } });
    }

    if (input.note) {
      const note = await tx.caseEvent.create({ data: { caseId: c.id, type: "NOTE", actorType: "STAFF", staffId, body: input.note } });
      await recordMentionsTx(tx, c.id, note.id, input.note, staffId);
    }
    if (input.action) await addActionTx(tx, c.id, input.action, staffId);

    return { case: c, newPersonId: input.newPerson ? requester.id : null };
  });

  if (created.newPersonId) {
    await writeAudit({
      entityType: "Member",
      entityId: created.newPersonId,
      action: AuditAction.CREATE,
      actorId: staffId,
      reason: `Added while opening case ${formatCaseNumber(created.case.caseNumber)}`,
    });
  }
  return created.case;
}

/** Changes whether Nomad helps under cover or as a special request. Someone
 * not covered can't be switched to "covered". */
export async function setCaseCoverage(caseId: string, coverage: CaseCoverage, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId }, include: { patient: { select: { isCovered: true } } } });
    if (c.coverage === coverage) return;
    if (coverage === "COVERED" && !c.patient.isCovered) throw new StaffCaseError("coverage", "notCovered");
    await tx.careCase.update({ where: { id: caseId }, data: { coverage } });
    await tx.caseEvent.create({ data: { caseId, type: "COVERAGE_CHANGED", actorType: "STAFF", staffId, data: { from: c.coverage, to: coverage } } });
  });
}

/** Shows the case in the member's app (so they can follow it and staff can
 * message them there), or hides it again. */
export async function setCaseVisibility(caseId: string, visible: boolean, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId } });
    if (c.visibleToMember === visible) return;
    await tx.careCase.update({ where: { id: caseId }, data: { visibleToMember: visible } });
    await tx.caseEvent.create({ data: { caseId, type: "VISIBILITY_CHANGED", actorType: "STAFF", staffId, data: { visible } } });
  });
}
