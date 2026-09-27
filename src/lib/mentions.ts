/** @mentions in internal notes. A mention is "@" + a handle (see
 * src/lib/handle.ts) that isn't part of a word or an email address:
 * "ask @jerome." and "(@a.diallo)" mention, "jean@clinic.sn" doesn't. */

const MENTION = /(^|[^A-Za-z0-9._@])@([A-Za-z0-9][A-Za-z0-9._]{1,28}[A-Za-z0-9])/g;

/** Every handle mentioned in the text, lowercase, each once, in order. */
export function extractMentions(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(MENTION)) seen.add(m[2].toLowerCase());
  return [...seen];
}

export type MentionPart = { text: string } | { handle: string; raw: string };

/** The text cut into plain runs and mentions, for rendering mentions as tags. */
export function splitMentions(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = m.index + m[1].length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ handle: m[2].toLowerCase(), raw: `@${m[2]}` });
    last = start + 1 + m[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** The "@jer" being typed just before the caret, if any — what the note
 * box's suggestion list filters on. */
export function mentionQueryAt(text: string, caret: number): { query: string; start: number } | null {
  const m = /(^|[^A-Za-z0-9._@])@([A-Za-z0-9._]{0,30})$/.exec(text.slice(0, caret));
  return m ? { query: m[2].toLowerCase(), start: caret - m[2].length - 1 } : null;
}
