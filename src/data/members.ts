import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import { parseMemberNumber } from "@/lib/memberNumber";
import type { MemberInput } from "@/lib/validation/members";
import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "./audit";

/** Staff search results are capped — the list is for finding someone, and
 * a larger member base is browsed by narrowing the search, not scrolling. */
const SEARCH_LIMIT = 200;

/** A household rule the form can't check on its own (it needs the
 * database). Thrown by create/update and turned into a field error by the
 * calling Server Action. */
export class HouseholdRuleError extends Error {
  constructor(
    public field: "primaryMemberId",
    message: string,
  ) {
    super(message);
  }
}

const listInclude = {
  organization: { select: { id: true, name: true } },
  relationship: { select: { nameEn: true, nameFr: true } },
  primaryMember: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
  _count: { select: { dependents: true } },
} satisfies Prisma.MemberInclude;

export async function searchMembers(filters: { q?: string; organizationId?: string; status: "ACTIVE" | "INACTIVE" | "ALL"; coverage?: "ALL" | "COVERED" | "NOT_COVERED" }) {
  const where: Prisma.MemberWhereInput = {
    ...(filters.status !== "ALL" && { status: filters.status }),
    ...(filters.coverage === "COVERED" && { isCovered: true }),
    ...(filters.coverage === "NOT_COVERED" && { isCovered: false }),
    ...(filters.organizationId && { organizationId: filters.organizationId }),
  };
  if (filters.q) {
    const q = filters.q;
    const memberNumber = parseMemberNumber(q);
    const words = q.split(/\s+/).filter(Boolean);
    where.OR = [
      ...(memberNumber !== null ? [{ memberNumber }] : []),
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q.replace(/\s+/g, "") } },
      { policyNumber: { contains: q, mode: "insensitive" } },
      // Every typed word must match the first or last name, in any order —
      // "Ndiaye Awa" and "awa nd" both find Awa Ndiaye.
      {
        AND: words.map((w) => ({
          OR: [{ firstName: { contains: w, mode: "insensitive" } }, { lastName: { contains: w, mode: "insensitive" } }],
        })),
      },
    ];
  }
  const [members, total] = await Promise.all([
    prisma.member.findMany({ where, include: listInclude, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: SEARCH_LIMIT }),
    prisma.member.count({ where }),
  ]);
  return { members, total, limit: SEARCH_LIMIT };
}

/** One member plus their whole household — for a dependent, that's their
 * primary member and the primary's other dependents. */
export async function getMemberWithHousehold(id: string) {
  const member = await prisma.member.findUnique({
    where: { id },
    include: { organization: true, country: true, relationship: true, primaryMember: true },
  });
  if (!member) return null;
  const primaryId = member.primaryMemberId ?? member.id;
  const household = await prisma.member.findMany({
    where: { OR: [{ id: primaryId }, { primaryMemberId: primaryId }] },
    include: { relationship: true },
    orderBy: [{ primaryMemberId: { sort: "asc", nulls: "first" } }, { dateOfBirth: "asc" }],
  });
  return { member, household };
}

/** Active primary members only — options for the "Dependent of" picker. */
export function listPrimaryMemberOptions() {
  return prisma.member.findMany({
    where: { primaryMemberId: null, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

async function assertHouseholdRules(memberId: string | null, primaryMemberId: string | undefined) {
  if (!primaryMemberId) return;
  if (primaryMemberId === memberId) throw new HouseholdRuleError("primaryMemberId", "A member can't be their own dependent.");
  const primary = await prisma.member.findUnique({ where: { id: primaryMemberId }, select: { primaryMemberId: true } });
  if (!primary) throw new HouseholdRuleError("primaryMemberId", "That primary member no longer exists.");
  if (primary.primaryMemberId) {
    throw new HouseholdRuleError("primaryMemberId", "Choose a primary member: that person is already someone else's dependent.");
  }
  if (memberId) {
    const dependents = await prisma.member.count({ where: { primaryMemberId: memberId } });
    if (dependents > 0) {
      throw new HouseholdRuleError("primaryMemberId", "This member has dependents, so they can't become a dependent themselves.");
    }
  }
}

/** Form values → Prisma data. Optional fields left empty are stored as null,
 * so clearing a field in the edit form actually clears it. A primary member
 * never keeps a relationship. */
function toData(input: MemberInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth ?? null,
    sex: input.sex,
    email: input.email ?? null,
    phone: input.phone ?? null,
    preferredLanguage: input.preferredLanguage,
    countryId: input.countryId ?? null,
    city: input.city ?? null,
    primaryMemberId: input.primaryMemberId ?? null,
    relationshipId: input.primaryMemberId ? (input.relationshipId ?? null) : null,
    organizationId: input.organizationId ?? null,
    planName: input.planName ?? null,
    policyNumber: input.policyNumber ?? null,
    coverageStart: input.coverageStart ?? null,
    coverageEnd: input.coverageEnd ?? null,
    isCovered: input.isCovered,
  };
}

function auditValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export async function createMember(input: MemberInput, actorId: string) {
  await assertHouseholdRules(null, input.primaryMemberId);
  const member = await prisma.member.create({ data: { ...toData(input), createdBy: actorId, updatedBy: actorId } });
  await writeAudit({ entityType: "Member", entityId: member.id, action: AuditAction.CREATE, actorId });
  return member;
}

/** One audit row per changed field — member records hold personal data, so
 * the trail shows exactly what changed, same as provider edits. */
export async function updateMember(id: string, input: MemberInput, actorId: string) {
  await assertHouseholdRules(id, input.primaryMemberId);
  const existing = await prisma.member.findUniqueOrThrow({ where: { id } });
  const data = toData(input);
  const member = await prisma.member.update({ where: { id }, data: { ...data, updatedBy: actorId } });
  for (const [field, newValue] of Object.entries(data)) {
    const previous = auditValue(existing[field as keyof typeof existing]);
    const next = auditValue(newValue);
    if (previous !== next) {
      await writeAudit({ entityType: "Member", entityId: id, action: AuditAction.UPDATE, actorId, fieldName: field, previousValue: previous, newValue: next });
    }
  }
  return member;
}

/** Deactivate/reactivate — never a hard delete (cases will point at members).
 * Deactivating a primary member also deactivates their dependents, since
 * their cover comes through the primary; reactivating only restores the
 * primary, so each dependent is a deliberate choice. */
export async function setMemberStatus(id: string, status: "ACTIVE" | "INACTIVE", actorId: string) {
  const member = await prisma.member.update({ where: { id }, data: { status, updatedBy: actorId } });
  await writeAudit({ entityType: "Member", entityId: id, action: AuditAction.UPDATE, actorId, fieldName: "status", newValue: status });
  if (status === "INACTIVE" && !member.primaryMemberId) {
    const dependents = await prisma.member.findMany({ where: { primaryMemberId: id, status: "ACTIVE" }, select: { id: true } });
    for (const d of dependents) {
      await prisma.member.update({ where: { id: d.id }, data: { status, updatedBy: actorId } });
      await writeAudit({
        entityType: "Member",
        entityId: d.id,
        action: AuditAction.UPDATE,
        actorId,
        fieldName: "status",
        newValue: status,
        reason: "Primary member deactivated",
      });
    }
  }
  return member;
}

export function listActiveOrganizations() {
  return prisma.organizationRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export function listActiveRelationships() {
  return prisma.memberRelationshipRef.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] });
}
