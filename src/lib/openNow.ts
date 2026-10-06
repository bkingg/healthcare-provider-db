/** Whether a provider (e.g. a pharmacy) is open at a moment: the Open 24/7
 * box, or else its posted office hours. Office hours are Dakar wall-clock
 * times — Dakar is UTC+0 all year, so they compare directly with UTC.
 * A closing time at or before the opening time runs past midnight
 * (e.g. 20:00–02:00). No hours posted and not 24/7 = not known to be open. */

export type OfficeHoursRow = { dayOfWeek: string; openTime: Date; closeTime: Date };

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const minutes = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

export function isOpenAt(p: { isOpen24_7: boolean; officeHours: OfficeHoursRow[] }, at: Date): boolean {
  if (p.isOpen24_7) return true;
  const now = minutes(at);
  const today = DAYS[at.getUTCDay()];
  const yesterday = DAYS[(at.getUTCDay() + 6) % 7];
  return p.officeHours.some((h) => {
    const open = minutes(h.openTime);
    const close = minutes(h.closeTime);
    if (close > open) return h.dayOfWeek === today && now >= open && now < close;
    // Overnight: open from `open` today until `close` tomorrow.
    return (h.dayOfWeek === today && now >= open) || (h.dayOfWeek === yesterday && now < close);
  });
}
