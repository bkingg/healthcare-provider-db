const DAKAR_TIME_ZONE = "Africa/Dakar";

/** Formats a date/time anchored to Dakar, Senegal (UTC+0, no DST) regardless
 * of the viewer's own timezone — this app's data is Senegal-based, so "when
 * was this updated" should read the same for every viewer instead of
 * shifting with wherever they happen to be browsing from. */
export function formatDakarDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: DAKAR_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Date-only counterpart (e.g. "Sep 14, 2026") — same Dakar anchor and
 * "short month" style as formatDakarDateTime, for stamps that don't need a
 * time component (record verification, address validation). */
export function formatDakarDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: DAKAR_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
