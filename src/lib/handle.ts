/** Staff @handles (User.handle) — stored without the "@", lowercase.
 * Set by admins only (Admin → Users); shown wherever a staff member is
 * named, and accepted as `@handle` in case assignment and the Cases search. */

/** 3–30 characters: letters, digits, dots, underscores; starts and ends with
 * a letter or digit. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

/** What was typed → the stored form: no leading "@", no spaces, lowercase. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** A starting suggestion from an email address — the same rule the
 * migration used to backfill existing accounts (the part before "@",
 * reduced to allowed characters). */
export function suggestHandle(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 30)
    .replace(/[._]+$/, "");
  return cleaned.length >= 3 ? cleaned : "";
}

type Staff = { name: string | null; email: string; handle: string };

/** "Mariama Diallo (@mariama)" — how a staff member is named in the UI. */
export function staffLabel(user: Staff): string {
  return `${user.name ?? user.email} (@${user.handle})`;
}
