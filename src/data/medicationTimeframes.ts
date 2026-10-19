import "server-only";
import { prisma } from "@/lib/prisma";
import { localizedText } from "@/lib/localizedText";

/** The order form's "When do you need it?" choices, as set in Admin >
 * Value lists > Medication delivery > Delivery timeframes. Each code is a
 * case urgency the rest of the app understands. */
export const TIMEFRAME_CODES = ["WITHIN_HOUR", "TODAY", "THIS_WEEK", "ROUTINE"] as const;
export type TimeframeCode = (typeof TIMEFRAME_CODES)[number];
export type TimeframeOption = { code: TimeframeCode; label: string; help: string | null };

/** The offered choices, in the admin's order. If every one was switched off
 * (or the rows are missing) all four are offered, so a member can always
 * place an order. */
export async function offeredTimeframes(locale: string): Promise<TimeframeOption[]> {
  const rows = await prisma.medicationTimeframeRef.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  const known = rows.filter((r): r is typeof r & { code: TimeframeCode } => (TIMEFRAME_CODES as readonly string[]).includes(r.code));
  const offered = known.filter((r) => r.isOffered);
  const list = offered.length ? offered : known;
  if (!list.length) return TIMEFRAME_CODES.map((code) => ({ code, label: code, help: null }));
  return list.map((r) => ({ code: r.code, label: localizedText(r.labelEn, r.labelFr, locale) ?? r.labelEn, help: localizedText(r.helpEn, r.helpFr, locale) }));
}
