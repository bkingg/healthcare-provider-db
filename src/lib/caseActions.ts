/** Timing rules for case next actions. Dakar is UTC+0 all year (no daylight
 * saving), so a Dakar wall-clock time is the UTC time: "2026-09-27T15:00"
 * typed in the form is 15:00Z. */

export type ActionTiming = "OVERDUE" | "TODAY" | "UPCOMING";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Overdue once the due time has passed; otherwise today or later. */
export function actionTiming(dueAt: Date, now: Date): ActionTiming {
  if (dueAt.getTime() < now.getTime()) return "OVERDUE";
  return dayKey(dueAt) === dayKey(now) ? "TODAY" : "UPCOMING";
}

/** The `datetime-local` value ("2026-09-27T15:00") → the instant. */
export function parseDueInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** An instant → the `datetime-local` value, in Dakar time. */
export function toDueInput(d: Date): string {
  return d.toISOString().slice(0, 16);
}

/** The quick picks under the due-time field: in 1 hour (rounded up to the
 * next 5 minutes), today at 17:00 while that's still ahead, tomorrow 09:00. */
export function quickDueTimes(now: Date): { key: "inOneHour" | "today17" | "tomorrow9"; at: Date }[] {
  const inOneHour = new Date(Math.ceil((now.getTime() + 3_600_000) / 300_000) * 300_000);
  const today17 = new Date(`${dayKey(now)}T17:00:00Z`);
  const tomorrow9 = new Date(`${dayKey(new Date(now.getTime() + 86_400_000))}T09:00:00Z`);
  return [
    { key: "inOneHour", at: inOneHour },
    ...(today17.getTime() > inOneHour.getTime() ? [{ key: "today17" as const, at: today17 }] : []),
    { key: "tomorrow9", at: tomorrow9 },
  ];
}
