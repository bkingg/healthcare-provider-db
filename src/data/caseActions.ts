import "server-only";
import { prisma } from "@/lib/prisma";
import { schedulePush } from "@/lib/push";
import { extractMentions } from "@/lib/mentions";
import type { Prisma } from "../../generated/prisma/client";

/** Next actions, @mentions and the header bell (staff only — none of this
 * is ever shown to the member). Changes to actions write a case_event in the
 * same transaction, like every other case change (see caseOps.ts). */

type Tx = Prisma.TransactionClient;

const staffSelect = { id: true, name: true, email: true, handle: true } as const;

/** Only staff who can work cases can own an action or be mentioned. */
const caseWorkerWhere: Prisma.UserWhereInput = { isActive: true, role: { canWorkCases: true, isActive: true } };

export class NotACaseWorkerError extends Error {}

export type NewAction = { title: string; ownerId: string; dueAt: Date };

/** Adds a next action (inside the caller's transaction, so a note and the
 * action written with it are saved together). The owner is told through
 * the bell — unless they gave it to themselves. */
export async function addActionTx(tx: Tx, caseId: string, input: NewAction, staffId: string) {
  const owner = await tx.user.findFirst({ where: { id: input.ownerId, ...caseWorkerWhere }, select: { id: true } });
  if (!owner) throw new NotACaseWorkerError("The action's owner can't work cases.");
  const action = await tx.caseAction.create({ data: { caseId, title: input.title, ownerId: input.ownerId, dueAt: input.dueAt, createdById: staffId } });
  await tx.caseEvent.create({
    data: { caseId, type: "ACTION_ADDED", actorType: "STAFF", staffId, data: { actionId: action.id, title: input.title, ownerId: input.ownerId, dueAt: input.dueAt.toISOString() } },
  });
  if (input.ownerId !== staffId) {
    await tx.staffNotification.create({ data: { userId: input.ownerId, kind: "ACTION_ASSIGNED", caseId, actionId: action.id, actorId: staffId } });
    schedulePush();
  }
  return action;
}

export function addAction(caseId: string, input: NewAction, staffId: string) {
  return prisma.$transaction((tx) => addActionTx(tx, caseId, input, staffId));
}

/** Ticks an action off (or back on). Its "gave you an action" notification
 * is marked read once done — there's nothing left to do. */
export async function setActionDone(actionId: string, done: boolean, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const a = await tx.caseAction.findUniqueOrThrow({ where: { id: actionId } });
    if (Boolean(a.completedAt) === done) return;
    await tx.caseAction.update({
      where: { id: actionId },
      data: done ? { completedAt: new Date(), completedById: staffId } : { completedAt: null, completedById: null, closedWithCase: false },
    });
    await tx.caseEvent.create({ data: { caseId: a.caseId, type: done ? "ACTION_DONE" : "ACTION_REOPENED", actorType: "STAFF", staffId, data: { actionId, title: a.title } } });
    if (done) await tx.staffNotification.updateMany({ where: { actionId, readAt: null }, data: { readAt: new Date() } });
  });
  return prisma.caseAction.findUniqueOrThrow({ where: { id: actionId }, select: { caseId: true } });
}

/** Closes every open action on a case because the case is being resolved
 * or closed (after staff said yes to "close them too?"). */
export async function closeOpenActionsTx(tx: Tx, caseId: string, staffId: string) {
  const now = new Date();
  const open = await tx.caseAction.findMany({ where: { caseId, completedAt: null }, select: { id: true } });
  if (!open.length) return 0;
  await tx.caseAction.updateMany({ where: { id: { in: open.map((a) => a.id) } }, data: { completedAt: now, completedById: staffId, closedWithCase: true } });
  await tx.staffNotification.updateMany({ where: { actionId: { in: open.map((a) => a.id) }, readAt: null }, data: { readAt: now } });
  await tx.caseEvent.create({ data: { caseId, type: "ACTIONS_CLOSED_WITH_CASE", actorType: "STAFF", staffId, data: { count: open.length } } });
  return open.length;
}

/** Records who a just-saved internal note mentions, and tells them — the
 * author too, if they mention themselves. Handles that aren't a case
 * worker's stay plain text. */
export async function recordMentionsTx(tx: Tx, caseId: string, eventId: string, body: string, staffId: string) {
  const handles = extractMentions(body);
  if (!handles.length) return [];
  const people = await tx.user.findMany({ where: { handle: { in: handles }, ...caseWorkerWhere }, select: { id: true, handle: true } });
  for (const p of people) {
    await tx.caseMention.create({ data: { eventId, userId: p.id, handle: p.handle } });
    await tx.staffNotification.create({ data: { userId: p.id, kind: "MENTION", caseId, eventId, actorId: staffId } });
  }
  if (people.length) schedulePush();
  return people;
}

// ------------------------------------------------------------------ reading

const caseSummarySelect = {
  id: true,
  caseNumber: true,
  rag: true,
  status: true,
  category: { select: { nameEn: true, nameFr: true } },
  patient: { select: { firstName: true, lastName: true } },
} as const;

/** Open actions owned by this person, soonest first — "My actions". */
export function listMyOpenActions(userId: string) {
  return prisma.caseAction.findMany({
    where: { ownerId: userId, completedAt: null },
    orderBy: { dueAt: "asc" },
    include: { case: { select: caseSummarySelect }, createdBy: { select: staffSelect } },
    take: 300,
  });
}

/** Overdue open actions per person, most first — the Cases dashboard. */
export async function overdueActionsByPerson(now = new Date()) {
  const rows = await prisma.caseAction.groupBy({ by: ["ownerId"], where: { completedAt: null, dueAt: { lt: now } }, _count: { _all: true } });
  if (!rows.length) return [];
  const people = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: staffSelect });
  return rows
    .map((r) => ({ user: people.find((p) => p.id === r.ownerId)!, count: r._count._all }))
    .filter((r) => r.user)
    .sort((a, b) => b.count - a.count);
}

/** What the header bell shows: your open actions that are due now (they
 * stay until ticked off), and the latest mentions / actions given to you
 * (unread first to catch the eye; read ones stay listed, dimmed). */
export async function bellFor(userId: string, now = new Date()) {
  const [due, dueCount, notifications, unread] = await Promise.all([
    prisma.caseAction.findMany({
      where: { ownerId: userId, completedAt: null, dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
      take: 20,
      include: { case: { select: caseSummarySelect } },
    }),
    prisma.caseAction.count({ where: { ownerId: userId, completedAt: null, dueAt: { lte: now } } }),
    prisma.staffNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        case: { select: caseSummarySelect },
        actor: { select: staffSelect },
        event: { select: { body: true, type: true, member: { select: { firstName: true } } } },
        action: { select: { title: true, dueAt: true, completedAt: true } },
      },
    }),
    prisma.staffNotification.count({ where: { userId, readAt: null } }),
  ]);
  return { due, dueCount, notifications, unread };
}

export function markNotificationRead(id: string, userId: string) {
  return prisma.staffNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export function markAllNotificationsRead(userId: string) {
  return prisma.staffNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/** Opening a case counts as having seen what others told you about it.
 * Mentioning yourself is a reminder, so those stay until clicked in the bell
 * (saving the note reloads the case page, which would otherwise clear it). */
export function markCaseNotificationsRead(caseId: string, userId: string) {
  return prisma.staffNotification.updateMany({
    where: { caseId, userId, readAt: null, OR: [{ actorId: null }, { actorId: { not: userId } }] },
    data: { readAt: new Date() },
  });
}
