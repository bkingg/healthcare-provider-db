/** Nomad's office hours (MVP step 1.3): Monday–Friday, 09:00–17:00 in Dakar.
 * Outside them, on-call staff handle urgent (red) cases only — which is why
 * red's response time runs on the 24/7 clock and yellow/green count office
 * hours (case_response_target.business_hours_only).
 *
 * Dakar is on UTC all year (no daylight saving), so office hours are plain
 * UTC hours here. If Nomad adds an office in another time zone, this is the
 * one place to change. */
export const OFFICE = { timeZone: "Africa/Dakar", utcOffsetHours: 0, days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 } as const;

const MINUTE = 60_000;

function officeWindow(day: Date): { open: number; close: number } | null {
  const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  if (!(OFFICE.days as readonly number[]).includes(d.getUTCDay())) return null;
  const base = d.getTime() - OFFICE.utcOffsetHours * 60 * MINUTE;
  return { open: base + OFFICE.startHour * 60 * MINUTE, close: base + OFFICE.endHour * 60 * MINUTE };
}

export function isOfficeHours(at: Date): boolean {
  const w = officeWindow(at);
  return w !== null && at.getTime() >= w.open && at.getTime() < w.close;
}

/** When a response is due: `minutes` after `from`, counting every minute
 * (24/7, on-call) or only office-hours minutes — a yellow case arriving on
 * Friday at 16:30 with 120 minutes is due Monday at 10:30. */
export function responseDueAt(from: Date, minutes: number, businessHoursOnly: boolean): Date {
  if (!businessHoursOnly) return new Date(from.getTime() + minutes * MINUTE);
  let remaining = minutes * MINUTE;
  let cursor = from.getTime();
  // Walk day by day; bounded so a bad setting can't loop forever.
  for (let i = 0; i < 400 && remaining > 0; i++) {
    const w = officeWindow(new Date(cursor));
    if (w && cursor < w.close) {
      const start = Math.max(cursor, w.open);
      const available = w.close - start;
      if (remaining <= available) return new Date(start + remaining);
      remaining -= available;
    }
    const next = new Date(cursor);
    cursor = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate() + 1) - OFFICE.utcOffsetHours * 60 * MINUTE;
  }
  return new Date(cursor + remaining);
}
