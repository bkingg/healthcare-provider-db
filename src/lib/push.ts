import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatCaseNumber } from "@/lib/caseNumber";

/** Phone alerts (web push) for members and staff. The alert only says that
 * something changed on a case — never what — because it shows on the lock
 * screen; the details are in the app after signing in. Always sent: no
 * quiet hours.
 *
 * Sending is decoupled from the change itself: whatever creates a staff
 * notification or a message to a member calls schedulePush(), and after the
 * response is sent flushPushes() claims everything not yet pushed. A row is
 * claimed once (pushed_at), so two flushes never send the same alert. */

/** Older than this and it isn't worth an alert any more (e.g. the server
 * was down) — it's still in the app. */
const STALE_MINUTES = 30;

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

type Alert = { title: string; body: string; url: string; tag: string };

const TEXT = {
  fr: {
    memberTitle: "Nomad",
    memberBody: (n: string) => `Votre demande ${n} a été mise à jour. Ouvrez l'application pour voir.`,
    staffTitle: "Nomad",
    staffBody: (n: string) => `Nouvelle mise à jour sur le dossier ${n}.`,
  },
  en: {
    memberTitle: "Nomad",
    memberBody: (n: string) => `Your request ${n} has been updated. Open the app to see it.`,
    staffTitle: "Nomad",
    staffBody: (n: string) => `New update on case ${n}.`,
  },
} as const;

const lang = (l: string) => (l === "en" ? "en" : "fr");

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; locale: string };

async function send(sub: Sub, alert: Alert): Promise<void> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(alert), { TTL: 24 * 60 * 60, urgency: "high", topic: alert.tag.slice(0, 32) });
    await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date() } }).catch(() => {});
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // The browser dropped this subscription (app removed, permission off).
    if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
    else console.error("[push] not sent:", status ?? err);
  }
}

/** Claims and sends every alert not sent yet. Safe to run at any time and
 * from several places at once. */
export async function flushPushes(): Promise<void> {
  if (!pushConfigured()) return;
  configure();
  const since = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const staff = await prisma.$queryRaw<{ user_id: string; case_id: string }[]>`
    UPDATE staff_notification SET pushed_at = now()
    WHERE pushed_at IS NULL AND created_at > ${since}
    RETURNING user_id, case_id`;
  const member = await prisma.$queryRaw<{ case_id: string }[]>`
    UPDATE case_event SET pushed_at = now()
    WHERE pushed_at IS NULL AND type = 'MESSAGE_TO_MEMBER' AND visible_to_member AND created_at > ${since}
    RETURNING case_id`;
  if (!staff.length && !member.length) return;

  const caseIds = [...new Set([...staff.map((s) => s.case_id), ...member.map((m) => m.case_id)])];
  const cases = await prisma.careCase.findMany({
    where: { id: { in: caseIds } },
    select: { id: true, caseNumber: true, visibleToMember: true, requestedById: true, patientId: true, patient: { select: { primaryMemberId: true } } },
  });
  const byId = new Map(cases.map((c) => [c.id, c]));
  const jobs: Promise<void>[] = [];

  // Staff: one alert per person and case, however many notifications.
  const staffPairs = new Set(staff.map((s) => `${s.user_id}|${s.case_id}`));
  for (const pair of staffPairs) {
    const [userId, caseId] = pair.split("|");
    const c = byId.get(caseId);
    if (!c) continue;
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    for (const sub of subs) {
      const l = lang(sub.locale);
      jobs.push(send(sub, { title: TEXT[l].staffTitle, body: TEXT[l].staffBody(formatCaseNumber(c.caseNumber)), url: `/${l}/cases/${c.id}`, tag: `case-${c.id}` }));
    }
  }

  // Members: whoever can see the request — who asked, who it's about, and
  // the main member of the household.
  for (const caseId of new Set(member.map((m) => m.case_id))) {
    const c = byId.get(caseId);
    if (!c || !c.visibleToMember) continue;
    const memberIds = [...new Set([c.requestedById, c.patientId, c.patient.primaryMemberId].filter((x): x is string => Boolean(x)))];
    const subs = await prisma.pushSubscription.findMany({ where: { memberId: { in: memberIds }, member: { status: "ACTIVE" } } });
    for (const sub of subs) {
      const l = lang(sub.locale);
      jobs.push(send(sub, { title: TEXT[l].memberTitle, body: TEXT[l].memberBody(formatCaseNumber(c.caseNumber)), url: `/${l}/m/requests/${c.id}`, tag: `case-${c.id}` }));
    }
  }
  await Promise.all(jobs);
}

/** Sends pending alerts once the current response is done (so after the
 * change that created them has been saved). Outside a request — scripts,
 * tests — it does nothing; those rows go out with the next flush. */
export function schedulePush(): void {
  if (!pushConfigured()) return;
  try {
    after(() => flushPushes().catch((err) => console.error("[push] flush failed:", err)));
  } catch {
    // Not inside a request.
  }
}
