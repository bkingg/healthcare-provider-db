import "server-only";
import { prisma } from "@/lib/prisma";
import { responseDueAt } from "@/lib/businessHours";
import { escalate, ragRank, type Rag } from "@/lib/caseRules";
import { parseSearchParams } from "@/lib/validation/search";
import { searchAddress } from "@/lib/geocode";
import { searchProviders } from "./search";
import type { CaseEventType, CaseStatus, Prisma } from "../../generated/prisma/client";

/** Case operations (MVP step 1.3) — the staff side of a case, plus the
 * member actions that feed it (new request, reply). Every change writes a
 * case_event in the same transaction, so the timeline is the audit trail. */

export const OPEN_STATUSES: CaseStatus[] = ["NEW", "IN_PROGRESS", "WAITING_MEMBER"];
/** Statuses where Nomad owes the member a response — the timer runs. */
const TIMER_STATUSES: CaseStatus[] = ["NEW", "IN_PROGRESS"];

type Tx = Prisma.TransactionClient;

async function loadTargets(db: Tx | typeof prisma = prisma) {
  const rows = await db.caseResponseTarget.findMany({ where: { isActive: true } });
  return new Map(rows.map((r) => [r.code as Rag, r]));
}

/** When staff must respond to a case of this colour, starting `from`. A
 * colour with no active response time has no deadline. */
export async function dueFor(rag: Rag, from: Date, db: Tx | typeof prisma = prisma): Promise<Date | null> {
  const target = (await loadTargets(db)).get(rag);
  return target ? responseDueAt(from, target.minutes, target.businessHoursOnly) : null;
}

function addEvent(tx: Tx, caseId: string, e: { type: CaseEventType; actorType: "MEMBER" | "STAFF" | "SYSTEM"; staffId?: string; memberId?: string; body?: string; data?: Prisma.InputJsonValue; visibleToMember?: boolean }) {
  return tx.caseEvent.create({ data: { caseId, ...e } });
}

// ---------------------------------------------------------------- member side

/** A new request from the member app: the case, its first colour's timer,
 * and the "created" and "colour set" timeline entries. */
export async function createCaseWithTimeline(data: Prisma.CareCaseUncheckedCreateInput) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const created = await tx.careCase.create({ data: { ...data, responseDueAt: await dueFor(data.rag as Rag, now, tx) } });
    await addEvent(tx, created.id, { type: "CREATED", actorType: "MEMBER", memberId: data.requestedById });
    await addEvent(tx, created.id, { type: "COLOUR_SET", actorType: "SYSTEM", data: { to: created.rag, reasons: created.ragReasons } });
    return created;
  });
}

/** The member answers Nomad. Reopens a resolved or waiting case and restarts
 * the response timer at the case's current colour. Closed cases can't be
 * replied to (the member sends a new request instead). */
export async function memberReply(caseId: string, memberId: string, body: string) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId } });
    if (c.status === "CLOSED") throw new Error("This request is closed.");
    await tx.careCase.update({
      where: { id: caseId },
      data: { status: "IN_PROGRESS", resolvedAt: null, responseDueAt: await dueFor(c.rag as Rag, new Date(), tx), memberLastSeenAt: new Date() },
    });
    await addEvent(tx, caseId, { type: "MESSAGE_FROM_MEMBER", actorType: "MEMBER", memberId, body, visibleToMember: true });
    if (c.status !== "IN_PROGRESS") {
      await addEvent(tx, caseId, { type: "STATUS_CHANGED", actorType: "MEMBER", memberId, data: { from: c.status, to: "IN_PROGRESS" } });
    }
  });
}

export function memberConversation(caseId: string) {
  return prisma.caseEvent.findMany({
    where: { caseId, visibleToMember: true },
    include: { staff: { select: { name: true } }, member: { select: { firstName: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function markSeenByMember(caseId: string) {
  return prisma.careCase.update({ where: { id: caseId }, data: { memberLastSeenAt: new Date() } });
}

// ------------------------------------------------------------ overdue / escalation

/** Moves every overdue open case up one colour and gives it the new colour's
 * response time from now; an overdue red case stays red and just shows as
 * overdue. Run when staff open the dashboard or a case — no background job.
 * Cases from before step 1.3 (no deadline yet) get one from when they were
 * sent. Returns how many cases changed colour. */
export async function refreshOverdueCases(now = new Date()): Promise<number> {
  const targets = await loadTargets();
  const legacy = await prisma.careCase.findMany({ where: { status: { in: TIMER_STATUSES }, responseDueAt: null, events: { none: { actorType: "STAFF" } } } });
  for (const c of legacy) {
    const target = targets.get(c.rag as Rag);
    if (target) await prisma.careCase.update({ where: { id: c.id }, data: { responseDueAt: responseDueAt(c.createdAt, target.minutes, target.businessHoursOnly) } });
  }

  const overdue = await prisma.careCase.findMany({ where: { status: { in: TIMER_STATUSES }, rag: { not: "RED" }, responseDueAt: { lt: now } } });
  for (const c of overdue) {
    const to = escalate(c.rag as Rag);
    const target = targets.get(to);
    await prisma.$transaction(async (tx) => {
      // Re-checked inside the transaction so two staff opening the dashboard
      // at once can't escalate the same case twice.
      const changed = await tx.careCase.updateMany({
        where: { id: c.id, rag: c.rag, responseDueAt: c.responseDueAt },
        data: {
          rag: to,
          ragReasons: [...c.ragReasons.filter((r) => r !== "OVERDUE"), "OVERDUE"],
          responseDueAt: target ? responseDueAt(now, target.minutes, target.businessHoursOnly) : null,
        },
      });
      if (changed.count === 1) await addEvent(tx, c.id, { type: "ESCALATED", actorType: "SYSTEM", data: { from: c.rag, to, dueWas: c.responseDueAt?.toISOString() ?? null } });
    });
  }
  return overdue.length;
}

// --------------------------------------------------------------------- queue

export type QueueFilters = { colour?: Rag; status: "OPEN" | CaseStatus | "ALL"; assigned: "ANY" | "ME" | "UNASSIGNED" };

export async function caseQueue(filters: QueueFilters, staffId: string) {
  const where: Prisma.CareCaseWhereInput = {
    ...(filters.colour && { rag: filters.colour }),
    ...(filters.status === "OPEN" ? { status: { in: OPEN_STATUSES } } : filters.status === "ALL" ? {} : { status: filters.status }),
    ...(filters.assigned === "ME" ? { assignedToId: staffId } : filters.assigned === "UNASSIGNED" ? { assignedToId: null } : {}),
  };
  const cases = await prisma.careCase.findMany({
    where,
    include: {
      category: true,
      patient: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      // The latest message either way: shows "member replied" when theirs is last.
      events: { where: { type: { in: ["MESSAGE_FROM_MEMBER", "MESSAGE_TO_MEMBER"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { type: true } },
    },
    take: 300,
  });
  // Red, yellow, green; within a colour, the most pressing deadline first,
  // then the longest-waiting.
  cases.sort(
    (a, b) =>
      ragRank(a.rag as Rag) - ragRank(b.rag as Rag) ||
      (a.responseDueAt?.getTime() ?? Infinity) - (b.responseDueAt?.getTime() ?? Infinity) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return cases;
}

export async function queueCounts(now = new Date()) {
  const [byColour, overdue] = await Promise.all([
    prisma.careCase.groupBy({ by: ["rag"], where: { status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    prisma.careCase.count({ where: { status: { in: TIMER_STATUSES }, responseDueAt: { lt: now } } }),
  ]);
  const count = (rag: Rag) => byColour.find((r) => r.rag === rag)?._count._all ?? 0;
  return { RED: count("RED"), YELLOW: count("YELLOW"), GREEN: count("GREEN"), overdue };
}

/** Open red + yellow cases — the sidebar badge. */
export function attentionCount() {
  return prisma.careCase.count({ where: { status: { in: OPEN_STATUSES }, rag: { in: ["RED", "YELLOW"] } } });
}

// --------------------------------------------------------------- case detail

export async function getCaseForStaff(id: string) {
  const c = await prisma.careCase.findUnique({
    where: { id },
    include: {
      category: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      patient: { include: { relationship: true, organization: true, country: true } },
      requestedBy: { include: { organization: true } },
      events: { include: { staff: { select: { name: true, email: true } }, member: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
      providerOptions: {
        orderBy: { rank: "asc" },
        include: {
          provider: {
            include: {
              names: { orderBy: { isPrimary: "desc" }, take: 1 },
              providerTypes: { include: { providerType: true }, orderBy: { isPrimary: "desc" } },
              phones: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1 },
              addresses: { orderBy: { isPrimary: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  return c;
}

export function listCaseWorkers() {
  return prisma.user.findMany({ where: { isActive: true, role: { canWorkCases: true, isActive: true } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
}

// ------------------------------------------------------------- staff actions

export async function assignCase(caseId: string, assigneeId: string | null, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId } });
    if (c.assignedToId === assigneeId) return;
    await tx.careCase.update({ where: { id: caseId }, data: { assignedToId: assigneeId } });
    await addEvent(tx, caseId, { type: "ASSIGNED", actorType: "STAFF", staffId, data: { from: c.assignedToId, to: assigneeId } });
  });
}

/** Staff changing the status counts as responding — the timer stops —
 * except reopening to NEW. Resolved and closed record when. */
export async function setCaseStatus(caseId: string, status: CaseStatus, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId } });
    if (c.status === status) return;
    await tx.careCase.update({
      where: { id: caseId },
      data: {
        status,
        responseDueAt: status === "NEW" ? await dueFor(c.rag as Rag, new Date(), tx) : null,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
        // The first staff member to act on an unassigned case takes it.
        ...(c.assignedToId ? {} : { assignedToId: staffId }),
      },
    });
    await addEvent(tx, caseId, { type: "STATUS_CHANGED", actorType: "STAFF", staffId, data: { from: c.status, to: status } });
  });
}

export async function addInternalNote(caseId: string, body: string, staffId: string) {
  await prisma.$transaction((tx) => addEvent(tx, caseId, { type: "NOTE", actorType: "STAFF", staffId, body }).then(() => undefined));
}

/** A message the member sees in the app. It's a response: the timer stops,
 * and a new case moves to "in progress". */
export async function messageMember(caseId: string, body: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId } });
    const status = c.status === "NEW" ? "IN_PROGRESS" : c.status;
    await tx.careCase.update({ where: { id: caseId }, data: { status, responseDueAt: null, ...(c.assignedToId ? {} : { assignedToId: staffId }) } });
    await addEvent(tx, caseId, { type: "MESSAGE_TO_MEMBER", actorType: "STAFF", staffId, body, visibleToMember: true });
    if (status !== c.status) await addEvent(tx, caseId, { type: "STATUS_CHANGED", actorType: "STAFF", staffId, data: { from: c.status, to: status } });
  });
}

/** Staff set the colour by hand, with a reason. If the case is waiting on
 * Nomad, its deadline restarts at the new colour's response time. */
export async function overrideColour(caseId: string, rag: Rag, reason: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.careCase.findUniqueOrThrow({ where: { id: caseId } });
    if (c.rag === rag) return;
    await tx.careCase.update({
      where: { id: caseId },
      data: {
        rag,
        ragOverridden: true,
        ragReasons: ["STAFF_OVERRIDE"],
        ...(c.responseDueAt ? { responseDueAt: await dueFor(rag, new Date(), tx) } : {}),
      },
    });
    await addEvent(tx, caseId, { type: "COLOUR_OVERRIDDEN", actorType: "STAFF", staffId, body: reason, data: { from: c.rag, to: rag } });
  });
}

// --------------------------------------------------------- provider shortlist

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export class NoLocationError extends Error {}

/** Nearest active providers to the member — active only, so DO NOT USE
 * providers never appear. Uses the member's shared position, or looks up
 * the town they typed (on OpenStreetMap). Searches 25 km, widening to
 * 100 km if nothing is that close. Replaces earlier search results but
 * keeps any provider staff already selected. */
export async function findProvidersForCase(caseId: string, staffId: string) {
  const c = await prisma.careCase.findUniqueOrThrow({ where: { id: caseId }, include: { patient: { include: { country: true } } } });
  let point = c.latitude !== null && c.longitude !== null ? { lat: c.latitude, lng: c.longitude } : null;
  if (!point && c.locationLabel) {
    const query = [c.locationLabel, c.patient.country?.name].filter(Boolean).join(", ");
    const [hit] = await searchAddress(query);
    if (hit) point = { lat: hit.lat, lng: hit.lng };
  }
  if (!point) throw new NoLocationError("No location to search near.");

  let found: Awaited<ReturnType<typeof searchProviders>>["providers"] = [];
  let radiusKm = 25;
  for (const r of [25, 100]) {
    radiusKm = r;
    const filters = parseSearchParams({ lat: String(point.lat), lng: String(point.lng), radiusKm: String(r), statuses: "ACTIVE", pageSize: "10" });
    found = (await searchProviders(filters)).providers;
    if (found.length) break;
  }

  await prisma.$transaction(async (tx) => {
    await tx.caseProviderOption.deleteMany({ where: { caseId, source: "SEARCH", selected: false } });
    const kept = new Set((await tx.caseProviderOption.findMany({ where: { caseId }, select: { providerId: true } })).map((o) => o.providerId));
    let rank = 0;
    for (const p of found) {
      rank++;
      if (kept.has(p.id)) continue;
      const a = p.addresses?.[0];
      const distanceKm = a?.latitude != null && a?.longitude != null ? Math.round(haversineKm(point, { lat: a.latitude, lng: a.longitude }) * 10) / 10 : null;
      await tx.caseProviderOption.create({ data: { caseId, providerId: p.id, rank, distanceKm, source: "SEARCH" } });
    }
    await addEvent(tx, caseId, { type: "PROVIDERS_FOUND", actorType: "STAFF", staffId, data: { count: found.length, radiusKm, point } });
  });
  return { count: found.length, radiusKm };
}

export async function toggleProviderSelected(caseId: string, providerId: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const option = await tx.caseProviderOption.findUniqueOrThrow({ where: { caseId_providerId: { caseId, providerId } } });
    await tx.caseProviderOption.update({ where: { caseId_providerId: { caseId, providerId } }, data: { selected: !option.selected } });
    await addEvent(tx, caseId, { type: "PROVIDER_SELECTED", actorType: "STAFF", staffId, data: { providerId, selected: !option.selected } });
  });
}
