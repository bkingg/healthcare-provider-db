/** Reads latitude/longitude typed into a location box, so staff can search
 * from a point given as numbers (from WhatsApp, Google Maps, a GPS, a
 * paper form) instead of a place name. Latitude first, as Google Maps and
 * GPS apps show it.
 *
 * Decimal degrees:
 *   "14.7033, -17.4635"   "14.7033 -17.4635"   "14.7033;-17.4635"
 *   "14,7033; -17,4635"   (French decimal comma — then the pair needs a
 *                          ";" or a space between, not a comma)
 *   "14.7033N 17.4635W"   "N 14.7033, W 17.4635"
 * Degrees-minutes-seconds (and degrees + decimal minutes):
 *   14°42'12"N 17°27'49"W     14°42'12.5" N, 17°27'49.3" W
 *   N 14°42'12" W 17°27'49"   14°42.2'N 17°27.8'W   -17°27'49"
 *   14 42 12 N 17 27 49 W     (spaces only: the N/S/E/W letters are needed)
 * Anything else (a place name, out-of-range values, minutes or seconds of
 * 60 or more) returns null and is looked up as an address as before. */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const text = input
    .trim()
    .toUpperCase()
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″“”]|''/g, '"')
    .replace(/º/g, "°");
  if (!text) return null;
  return /[°'"]/.test(text) || /\d\s+\d+(?:[.,]\d+)?\s+\d/.test(text) ? parseDms(text) : parseDecimal(text);
}

type Hemisphere = string | undefined;

/** Signs the value from a leading "-" or an S / W letter, and checks the
 * letters say latitude then longitude. */
function finish(lat: number, latHem: Hemisphere, lng: number, lngHem: Hemisphere): { lat: number; lng: number } | null {
  if ((latHem && !"NS".includes(latHem)) || (lngHem && !"EW".includes(lngHem))) return null;
  const signed = (v: number, h: Hemisphere) => (h === "S" || h === "W" ? -Math.abs(v) : v);
  const a = signed(lat, latHem);
  const b = signed(lng, lngHem);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}

const toNumber = (n: string) => Number(n.replace(",", "."));

/** Matches "<value> <sep> <value>" with N/S/E/W letters either all before
 * the values ("N 14°42'12" W 17°27'49"") or all after them ("14°42'12"N
 * 17°27'49"W"), never mixed — so a letter between the two numbers is never
 * ambiguous. `value` has `groups` capture groups. Returns, for each side,
 * its letter and its value captures. */
function matchPair(text: string, value: string, groups: number, sep: string) {
  for (const lead of [false, true]) {
    const part = lead ? String.raw`([NSEW])?\s*${value}` : String.raw`${value}\s*([NSEW])?`;
    const m = new RegExp(String.raw`^${part}\s*${sep}\s*${part}$`).exec(text);
    if (!m) continue;
    const side = (offset: number) => {
      const g = m.slice(offset, offset + groups + 1);
      return lead ? { hem: g[0], values: g.slice(1) } : { hem: g[groups], values: g.slice(0, groups) };
    };
    const first = side(1);
    const sepText = m[1 + groups + 1];
    const second = side(1 + groups + 2);
    return { first, second, sep: sepText };
  }
  return null;
}

function parseDecimal(text: string) {
  const m = matchPair(text, String.raw`([+-]?\d{1,3}(?:[.,]\d+)?)`, 1, String.raw`([,;/]|\s)`);
  if (!m) return null;
  const [n1] = m.first.values;
  const [n2] = m.second.values;
  // "14,70, -17,46" is ambiguous; a decimal comma needs a ";" / space pair.
  if ((n1.includes(",") || n2.includes(",")) && m.sep === ",") return null;
  return finish(toNumber(n1), m.first.hem, toNumber(n2), m.second.hem);
}

function parseDms(text: string) {
  const dec = String.raw`\d{1,2}(?:[.,]\d+)?`;
  // With symbols: 14°42'12"  ·  14°42.2'  ·  14.7033°
  const withSymbols = String.raw`([+-]?\d{1,3}(?:[.,]\d+)?)\s*°\s*(?:(${dec})\s*'\s*(?:(${dec})\s*"\s*)?)?`;
  // Spaces only: 14 42 12 N — the letter is what makes it a coordinate.
  const spaced = String.raw`(\d{1,3})\s+(${dec})(?:\s+(${dec}))?`;
  for (const value of [withSymbols, spaced]) {
    const m = matchPair(text, value, 3, String.raw`([,;/]?)`);
    if (!m) continue;
    if (value === spaced && (!m.first.hem || !m.second.hem)) return null;
    const [d1, m1, s1] = m.first.values;
    const [d2, m2, s2] = m.second.values;
    const lat = dms(d1, m1, s1);
    const lng = dms(d2, m2, s2);
    if (lat === null || lng === null) return null;
    return finish(lat, m.first.hem, lng, m.second.hem);
  }
  return null;
}

/** Degrees + minutes/60 + seconds/3600, keeping a leading minus. Only the
 * last part given may have decimals; minutes and seconds stay under 60. */
function dms(d: string, m: string | undefined, s: string | undefined): number | null {
  const parts = [d, m, s].filter((x): x is string => x !== undefined);
  if (parts.slice(0, -1).some((x) => /[.,]/.test(x))) return null;
  const deg = toNumber(d);
  const min = m ? toNumber(m) : 0;
  const sec = s ? toNumber(s) : 0;
  if (min >= 60 || sec >= 60) return null;
  const value = Math.abs(deg) + min / 60 + sec / 3600;
  return d.trim().startsWith("-") ? -value : value;
}

/** "14.70330, -17.46350" — five decimals is about a metre. */
export function formatDecimalCoordinates(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}
