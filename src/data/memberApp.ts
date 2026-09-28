import "server-only";
import { prisma } from "@/lib/prisma";
import { initialRag } from "@/lib/caseRules";
import { createCaseWithTimeline } from "./caseOps";
import type { CurrentMember } from "@/lib/memberAuth";
import type { MemberRequestInput } from "@/lib/validation/memberRequest";

/** Data access for the member app. Every function takes the signed-in
 * member and only ever returns that member's own household's data. */

/** Who this member can ask for help for: a primary member for anyone active
 * and covered in their household; a dependent (e.g. an adult spouse with
 * their own sign-in) only for themselves. Someone not covered can't ask in
 * the app — Nomad takes those on as special requests, by phone. */
export async function requestablePeople(member: CurrentMember) {
  if (!member.isCovered) return [];
  if (member.primaryMemberId) return [member];
  const dependents = await prisma.member.findMany({
    where: { primaryMemberId: member.id, status: "ACTIVE", isCovered: true },
    include: { relationship: true },
    orderBy: { dateOfBirth: "asc" },
  });
  return [member, ...dependents];
}

/** Requests this member can see: a primary member sees their whole
 * household's; a dependent sees the ones they made or that are about them.
 * Only cases shown in the app — staff-created ones start hidden. */
function visibleCasesWhere(member: CurrentMember) {
  const whose = member.primaryMemberId
    ? { OR: [{ requestedById: member.id }, { patientId: member.id }] }
    : { OR: [{ requestedById: member.id }, { patient: { OR: [{ id: member.id }, { primaryMemberId: member.id }] } }] };
  return { AND: [{ visibleToMember: true }, whose] };
}

export function listMemberCases(member: CurrentMember) {
  return prisma.careCase.findMany({
    where: visibleCasesWhere(member),
    include: {
      category: true,
      patient: { select: { firstName: true, lastName: true } },
      // Latest message from Nomad — newer than memberLastSeenAt means unread.
      events: { where: { type: "MESSAGE_TO_MEMBER" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export function getMemberCase(member: CurrentMember, id: string) {
  return prisma.careCase.findFirst({
    where: { AND: [{ id }, visibleCasesWhere(member)] },
    include: { category: true, patient: { select: { firstName: true, lastName: true } } },
  });
}

export function listActiveCaseCategories() {
  return prisma.caseCategoryRef.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] });
}

/** Public emergency numbers for the member's country, plus numbers shown in
 * every country (the Nomad line). A member with no country on file gets
 * only the latter, and the app tells them to call their local emergency
 * number. `undefined` (the sign-in page, before anyone is known) returns
 * every active number. */
export async function emergencyContactsFor(countryId: string | null | undefined) {
  const contacts = await prisma.emergencyContactRef.findMany({
    where: countryId === undefined ? { isActive: true } : { isActive: true, OR: [{ countryId: null }, ...(countryId ? [{ countryId }] : [])] },
    orderBy: [{ sortOrder: "asc" }],
  });
  return { publicNumbers: contacts.filter((c) => c.kind === "PUBLIC"), nomadNumbers: contacts.filter((c) => c.kind === "NOMAD") };
}

export class RequestNotAllowedError extends Error {}

/** Creates the case with its first, rules-based colour (lib/caseRules.ts).
 * The patient must be someone this member may request help for, and the
 * category must still be active. */
export async function createMemberCase(member: CurrentMember, input: MemberRequestInput) {
  const people = await requestablePeople(member);
  if (!people.some((p) => p.id === input.patientId)) throw new RequestNotAllowedError("You can't request help for that person.");
  const category = await prisma.caseCategoryRef.findFirst({ where: { id: input.categoryId, isActive: true } });
  if (!category) throw new RequestNotAllowedError("That category isn't available any more.");

  const hasLocation = Boolean(input.locationLabel) || (input.latitude !== undefined && input.longitude !== undefined);
  const { rag, reasons } = initialRag({ urgency: input.urgency, categoryCode: category.code, description: input.description, hasLocation });
  // Created with its timeline ("created", "colour set") and first response
  // deadline — see data/caseOps.ts.
  return createCaseWithTimeline({
      requestedById: member.id,
      patientId: input.patientId,
      categoryId: category.id,
      description: input.description,
      contactPhone: input.contactPhone,
      contactHasWhatsapp: input.contactHasWhatsapp,
      urgency: input.urgency,
      locationLabel: input.locationLabel ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      rag,
      ragReasons: reasons,
      channel: "MEMBER_APP",
  });
}
