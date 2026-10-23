/** Takes personal details out of text before it's sent to the AI, and puts
 * them back in the answer. Known details (names, phone numbers, member and
 * policy numbers, addresses, dates of birth) become labelled placeholders
 * such as [MEMBER] or [PHONE_1]; anything that merely looks personal — an
 * e-mail, a phone number, a date, a link (pharmacy links carry secret
 * tokens), a long number — is caught by pattern too.
 *
 * Pure (no server imports) so it can be unit-tested on its own. */

type Entry = { placeholder: string; value: string; restoreTo: string };

const BOUNDARY_BEFORE = "(?<![\\p{L}\\p{N}])";
const BOUNDARY_AFTER = "(?![\\p{L}\\p{N}])";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Phone digits matched however they're spaced: "77 555 01 01",
 * "+221 77-555-0101", "775550101". Local numbers also match with +221. */
function phonePattern(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("221") && digits.length === 12) digits = digits.slice(3);
  if (digits.length < 7) return null;
  return `(?:\\+?\\s*221[\\s.-]*)?${digits.split("").join("[\\s.-]*")}`;
}

export class Redactor {
  private entries: Entry[] = [];
  private counters = new Map<string, number>();

  private next(label: string): string {
    const n = (this.counters.get(label) ?? 0) + 1;
    this.counters.set(label, n);
    return `[${label}_${n}]`;
  }

  /** A person: their full name, then first and last names on their own,
   * all shown as `[label]`. The answer gets their first name back (enough
   * for "Bonjour Awa"). */
  person(label: string, firstName: string | null | undefined, lastName: string | null | undefined): this {
    const first = firstName?.trim() ?? "";
    const last = lastName?.trim() ?? "";
    const placeholder = `[${label}]`;
    const restoreTo = first || last;
    for (const v of [`${first} ${last}`, `${last} ${first}`, first, last]) {
      // Very short names ("Al", "Bâ") would match ordinary words.
      if (v.trim().length >= 3 && !this.entries.some((e) => e.value.toLowerCase() === v.trim().toLowerCase())) {
        this.entries.push({ placeholder, value: v.trim(), restoreTo });
      }
    }
    return this;
  }

  /** Any other known detail (address, member number, policy number, date
   * of birth…), numbered within its label. */
  detail(label: string, value: string | null | undefined): this {
    const v = value?.trim();
    if (!v || v.length < 3) return this;
    const existing = this.entries.find((e) => e.value.toLowerCase() === v.toLowerCase());
    if (!existing) this.entries.push({ placeholder: this.next(label), value: v, restoreTo: v });
    return this;
  }

  phone(value: string | null | undefined): this {
    if (!value || !phonePattern(value)) return this;
    if (!this.entries.some((e) => e.placeholder.startsWith("[PHONE_") && e.value === value)) {
      this.entries.push({ placeholder: this.next("PHONE"), value, restoreTo: value });
    }
    return this;
  }

  private known(): { re: RegExp; entry: Entry }[] {
    return [...this.entries]
      .sort((a, b) => b.value.length - a.value.length)
      .map((entry) => {
        const isPhone = entry.placeholder.startsWith("[PHONE_");
        const body = isPhone ? phonePattern(entry.value)! : escape(entry.value).replace(/\s+/g, "\\s+");
        return { re: new RegExp(`${BOUNDARY_BEFORE}${body}${BOUNDARY_AFTER}`, "giu"), entry };
      });
  }

  /** Placeholders for anything found by pattern, remembered so the same
   * value always gets the same placeholder and comes back in the answer. */
  private found(label: string, value: string): string {
    const existing = this.entries.find((e) => e.value === value && e.placeholder.startsWith(`[${label}_`));
    if (existing) return existing.placeholder;
    const placeholder = this.next(label);
    // Kept out of `known()` matching order on purpose: it's only for restoring.
    this.entries.push({ placeholder, value, restoreTo: value });
    return placeholder;
  }

  redact(text: string | null | undefined): string {
    if (!text) return "";
    let out = text;
    // Links first: a link can contain digits that look like a phone number.
    out = out.replace(/\bhttps?:\/\/[^\s<>"')]+/gi, (m) => this.found("LINK", m));
    out = out.replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, (m) => this.found("EMAIL", m));
    for (const { re, entry } of this.known()) out = out.replace(re, entry.placeholder);
    // Phone numbers nobody told us about: 8+ digits, spaced or not.
    out = out.replace(/(?<![\p{L}\p{N}\]])\+?\d(?:[\s.-]?\d){7,}(?![\p{L}\p{N}])/gu, (m) => this.found("PHONE", m));
    // Dates such as 12/03/1985 or 1985-03-12.
    out = out.replace(/\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, (m) => this.found("DATE", m));
    // Member numbers.
    out = out.replace(/\bMBR-?\d+\b/gi, (m) => this.found("MEMBER_NUMBER", m));
    return out;
  }

  /** Puts the details back into the AI's answer. A placeholder the AI made
   * up (not one we gave it) is left as is, so staff see it and fix it. */
  restore(text: string): string {
    const byPlaceholder = new Map<string, string>();
    for (const e of this.entries) if (!byPlaceholder.has(e.placeholder)) byPlaceholder.set(e.placeholder, e.restoreTo);
    return text.replace(/\[[A-Z_]+(?:_\d+)?\]/g, (m) => byPlaceholder.get(m) ?? m);
  }
}
