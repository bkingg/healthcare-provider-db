/** When a medication order must be delivered, from when the member's
 * payment was received and the timeframe they chose (Admin > Delivery
 * timeframes). Dakar is on UTC all year, so times are worked out in UTC.
 *   WITHIN_HOUR  paid + 1 hour
 *   TODAY        paid before 20:00 → by the end of that day (23:59);
 *                paid at 20:00 or later → by 11:00 the next day
 *   THIS_WEEK    paid + 7 days
 *   ROUTINE      no deadline */
export const TODAY_CUTOFF_HOUR = 20;
export const NEXT_DAY_BY_HOUR = 11;

export function deliverBy(urgency: string, paidAt: Date): Date | null {
  const day = (offsetDays: number, h: number, m = 0) =>
    new Date(Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate() + offsetDays, h, m));
  switch (urgency) {
    case "WITHIN_HOUR":
      return new Date(paidAt.getTime() + 60 * 60 * 1000);
    case "TODAY":
      return paidAt.getUTCHours() < TODAY_CUTOFF_HOUR ? day(0, 23, 59) : day(1, NEXT_DAY_BY_HOUR);
    case "THIS_WEEK":
      return new Date(paidAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

/** Fills {placeholders} in an automatic message; unknown ones become empty.
 * Only spacing an empty placeholder leaves behind is tidied — French keeps
 * its space before ":", "!" and "?". */
export function fillTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body
    .replace(/[ \t]*\{(\w+)\}/g, (match: string, k: string) => {
      const v = vars[k];
      return v ? match.replace(`{${k}}`, v) : "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
