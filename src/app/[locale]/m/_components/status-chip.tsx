import { getTranslations } from "next-intl/server";

const STYLE: Record<string, string> = {
  NEW: "bg-pn-accent-soft text-[#08432c]",
  IN_PROGRESS: "bg-pn-ink text-white",
  WAITING_MEMBER: "bg-[#fcefd9] text-[#7a3d06]",
  RESOLVED: "border-2 border-pn-border-muted text-pn-gray-2",
  CLOSED: "border-2 border-pn-border-muted text-pn-gray-2",
};

/** A request's status in member-friendly words. Members never see the
 * internal red/yellow/green colour — that's for staff triage. */
export async function StatusChip({ status }: { status: string }) {
  const t = await getTranslations("MemberApp");
  return <span className={`inline-block px-2 py-0.5 text-[12px] font-bold ${STYLE[status] ?? STYLE.CLOSED}`}>{t(`status.${status}`)}</span>;
}
