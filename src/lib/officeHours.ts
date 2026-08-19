// Always formatted in UTC, matching how requiredTimeOfDay (validation/common.ts)
// builds the underlying Date — the stored value is a wall-clock time with no
// timezone of its own, so reading it back through the server's local
// timezone would silently shift what a user typed.
// 24-hour ("military") clock, zero-padded — matches the <input type="time">
// editor's own display convention rather than a 12-hour AM/PM readout.
const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export function formatTimeOfDay(time: Date): string {
  return TIME_FORMATTER.format(time);
}
