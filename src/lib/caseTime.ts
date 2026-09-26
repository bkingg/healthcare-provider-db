/** "2 h 05 min", "3 d 4 h", "12 min" — how long until (or since) a deadline,
 * compact enough for a queue row. Same shape in English and French. */
export function shortDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(Math.abs(ms) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}
