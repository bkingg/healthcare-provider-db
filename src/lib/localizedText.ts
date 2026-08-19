/** Picks the English/French variant of an admin-maintained text field for the
 * given locale, falling back to English when the French column hasn't been
 * filled in yet (translations are admin-entered, never auto-generated). */
export function localizedText(en: string | null | undefined, fr: string | null | undefined, locale: string): string | null {
  const picked = locale === "fr" ? (fr ?? en) : en;
  return picked ?? null;
}
