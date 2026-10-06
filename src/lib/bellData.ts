import type { bellFor } from "@/data/caseActions";
import { staffLabel } from "@/lib/handle";
import { notePreview } from "@/lib/notePreview";

/** The header bell's contents as plain data for the browser. */
export type BellCase = { id: string; caseNumber: number; rag: string; categoryEn: string; categoryFr: string | null; patient: string };
export type BellData = {
  /** The number on the bell: actions due now + unread notifications. */
  count: number;
  dueCount: number;
  unread: number;
  due: { actionId: string; title: string; dueAt: string; case: BellCase }[];
  items: {
    id: string;
    kind: "MENTION" | "ACTION_ASSIGNED" | "ORDER_UPDATE";
    /** For ORDER_UPDATE: what happened (a timeline entry type). */
    eventType: string | null;
    read: boolean;
    at: string;
    actor: string | null;
    /** The note's first line, or the action's title. */
    text: string;
    href: string;
    case: BellCase;
  }[];
};

type Raw = Awaited<ReturnType<typeof bellFor>>;

const toCase = (c: Raw["due"][number]["case"]): BellCase => ({
  id: c.id,
  caseNumber: c.caseNumber,
  rag: c.rag,
  categoryEn: c.category.nameEn,
  categoryFr: c.category.nameFr,
  patient: `${c.patient.firstName} ${c.patient.lastName}`.trim(),
});

export function toBellData(raw: Raw): BellData {
  return {
    count: raw.dueCount + raw.unread,
    dueCount: raw.dueCount,
    unread: raw.unread,
    due: raw.due.map((a) => ({ actionId: a.id, title: a.title, dueAt: a.dueAt.toISOString(), case: toCase(a.case) })),
    items: raw.notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      read: n.readAt !== null,
      at: n.createdAt.toISOString(),
      eventType: n.kind === "ORDER_UPDATE" ? (n.event?.type ?? null) : null,
      actor: n.actor ? staffLabel(n.actor) : n.event?.member?.firstName ?? null,
      text: n.kind === "MENTION" ? notePreview(n.event?.body ?? "") : n.kind === "ORDER_UPDATE" ? (n.event?.body ?? "") : (n.action?.title ?? ""),
      href: n.kind === "MENTION" && n.eventId ? `/cases/${n.caseId}?note=${n.eventId}` : n.kind === "ORDER_UPDATE" ? `/cases/${n.caseId}` : `/cases/${n.caseId}?action=${n.actionId ?? ""}`,
      case: toCase(n.case),
    })),
  };
}
