import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

/** Phone sign-in rules (WhatsApp codes) — pure, used on the server and in
 * tests. Uses the library's full metadata (to tell mobiles from landlines),
 * so keep it out of client components. */

export const CODE_LENGTH = 6;
export const CODE_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_PHONE_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 20;
export const TICKET_MINUTES = 15;
/** Version of the privacy notice a member accepts at quick start. */
export const CONSENT_VERSION = "2026-10";

/** Countries codes may be sent to — limits fraud that sends paid messages
 * to far-away numbers. MEMBER_CODE_COUNTRIES, e.g. "SN" or "SN,FR"; Senegal
 * by default. */
export function allowedCodeCountries(env: string | undefined = process.env.MEMBER_CODE_COUNTRIES): CountryCode[] {
  const list = (env ?? "SN")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is CountryCode => isSupportedCountry(c));
  return list.length ? list : ["SN"];
}

export type SignInPhone = {
  /** "+221771234567" */
  e164: string;
  /** "+221 77 123 45 67", as stored on member records. */
  international: string;
  /** "221771234567" and "771234567" — how a stored number may read once
   * its spaces and punctuation are dropped. */
  digitForms: string[];
  country: CountryCode;
};

/** A number typed on the sign-in screen, read in `country` unless it starts
 * with + or 00. Null when it isn't a valid mobile-capable number in an
 * allowed country. */
export function normalizeSignInPhone(raw: string, country: string, allowed: CountryCode[] = allowedCodeCountries()): SignInPhone | null {
  const cleaned = raw.trim().replace(/^00/, "+");
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, isSupportedCountry(country) ? (country as CountryCode) : "SN");
  if (!parsed?.isValid() || !parsed.country || !allowed.includes(parsed.country)) return null;
  const type = parsed.getType();
  if (type && !["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(type)) return null;
  return {
    e164: parsed.number,
    international: parsed.formatInternational(),
    digitForms: [`${parsed.countryCallingCode}${parsed.nationalNumber}`, String(parsed.nationalNumber)],
    country: parsed.country,
  };
}

/** Under-18s can't sign in on their own; an unknown date of birth counts
 * as adult (staff only record dependents' birthdays when they know them). */
export function isAdult(dateOfBirth: Date | null | undefined, now: Date = new Date()): boolean {
  if (!dateOfBirth) return true;
  const eighteenth = new Date(Date.UTC(dateOfBirth.getUTCFullYear() + 18, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()));
  return eighteenth <= now;
}

/** "+221 77 ••• •• 67" — shown after sending, so the member can spot a typo
 * without the screen showing their whole number. */
export function maskPhone(international: string): string {
  const digits = international.replace(/\D/g, "");
  let seen = 0;
  const total = digits.length;
  return international.replace(/\d/g, (d) => {
    seen++;
    return seen <= 5 || seen > total - 2 ? d : "•";
  });
}
