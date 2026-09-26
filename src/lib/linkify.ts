/** Splits message text into plain text and web links, so links typed in the
 * member ↔ case manager conversation (e.g. a Google Maps location) can be
 * rendered clickable. Only http(s) links — and bare "www." addresses, given
 * https — ever become links; nothing else (javascript:, data:, mailto:…) is
 * turned into an href. */
export type TextPart = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// Punctuation that usually ends the sentence rather than the link.
const TRAILING = /[.,;:!?'"»”’\]}>]+$/;

function trimTrailing(url: string): string {
  let out = url.replace(TRAILING, "");
  // A closing parenthesis belongs to the link only if it opened one
  // (Wikipedia-style URLs); otherwise it closes the surrounding sentence.
  while (out.endsWith(")") && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(TRAILING, "");
  }
  return out;
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const url = trimTrailing(raw);
    if (!url || url.length < 8) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: "text", text: text.slice(last, start) });
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push({ type: "link", text: url, href });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}
