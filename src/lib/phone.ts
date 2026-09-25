import { AsYouType, getCountries, getCountryCallingCode, getExampleNumber, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import examples from "libphonenumber-js/examples.mobile.json";

/** "+" plus the country's dialing code (e.g. "SN" -> "+221") — used to
 * prefill the Phones panel's "add phone" field with the right code for the
 * provider's own country, rather than leaving the user to know or type it. */
export function countryCallingCode(iso2: string): string | undefined {
  if (!isSupportedCountry(iso2)) return undefined;
  return `+${getCountryCallingCode(iso2 as CountryCode)}`;
}

export type PhoneCountryOption = { iso2: CountryCode; name: string; callingCode: string };

let phoneCountriesCache: PhoneCountryOption[] | undefined;

/** Every country libphonenumber-js has dialing metadata for, with a display
 * name (via `Intl.DisplayNames`, so there's no separate country-name list to
 * keep in sync) and calling code, sorted by name — backs the ad hoc "country
 * code" picker next to phone number fields, so a number can be entered in a
 * different country's format than the provider's own (e.g. a US-based
 * answering service fielding calls for a Senegalese clinic). Computed once
 * and cached: the list is the same for every caller in a given locale. */
export function phoneCountries(): PhoneCountryOption[] {
  if (phoneCountriesCache) return phoneCountriesCache;
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  phoneCountriesCache = getCountries()
    .map((iso2) => ({ iso2, name: displayNames.of(iso2) ?? iso2, callingCode: getCountryCallingCode(iso2) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return phoneCountriesCache;
}

/** Digit count of a "standard" number in `iso2`, taken from that country's
 * representative example number (e.g. 9 for Senegal, 10 for the US) — the
 * cap formatting truncates to, so a pasted/typed number can't run longer
 * than a real number in that country ever would. */
function nationalNumberMaxLength(iso2: CountryCode): number | undefined {
  return getExampleNumber(iso2, examples)?.nationalNumber.length;
}

/** Strips `iso2`'s own dial code off the front of `digitsOnly`, if present —
 * the "undo what formatting for this exact country already prepended"
 * half of reformatting, kept separate from formatPhoneInput/reformatForCountry
 * so each only ever strips the country it's actually formatted *for*, never
 * the target of a country switch (see reformatForCountry). */
function stripOwnDialCode(digitsOnly: string, iso2: CountryCode): string {
  const code = getCountryCallingCode(iso2);
  return digitsOnly.startsWith(code) ? digitsOnly.slice(code.length) : digitsOnly;
}

/** Truncates `nationalDigits` to `iso2`'s standard length and groups them
 * the way that country formats numbers, with the dial code prefixed. Empty
 * digits short-circuit to `"+<code> "` rather than AsYouType's bare `"+<code>"`
 * (no trailing space) — keeps the field's empty state identical whether it
 * just mounted or the country was switched with nothing typed yet. */
function truncateAndFormat(nationalDigits: string, iso2: CountryCode): string {
  const code = getCountryCallingCode(iso2);
  if (!nationalDigits) return `+${code} `;
  const maxLength = nationalNumberMaxLength(iso2);
  const truncated = maxLength ? nationalDigits.slice(0, maxLength) : nationalDigits;
  return new AsYouType().input(`+${code}${truncated}`);
}

/** Reformats a phone field's value into `iso2`'s standard international
 * grouping as the user types — e.g. "771234567" in Senegal becomes
 * "+221 77 123 45 67" — truncating extra digits to that country's standard
 * length instead of letting the field grow past what a real number there
 * can be. `raw` may already carry the leading "+" and dial code (as it will
 * on every keystroke after the first, or if pasted); those are stripped and
 * re-derived rather than doubled up, since `raw` is assumed to already be
 * formatted *for `iso2`* — if the field's country was just switched, use
 * reformatForCountry instead. Countries libphonenumber-js has no metadata
 * for fall back to returning `raw` unchanged. */
export function formatPhoneInput(raw: string, iso2: string): string {
  if (!isSupportedCountry(iso2)) return raw;
  const digitsOnly = raw.replace(/\D/g, "");
  return truncateAndFormat(stripOwnDialCode(digitsOnly, iso2), iso2);
}

/** Re-derives the pure national digits typed so far by stripping `fromIso2`'s
 * dial code — the country the field was previously formatted for — off
 * `value`, then formats/truncates those digits for `toIso2`. Used when the ad
 * hoc country picker changes: reusing formatPhoneInput there would instead
 * try to strip `toIso2`'s code from digits that actually carry `fromIso2`'s,
 * leaking the old dial code into the new country's national number (e.g.
 * Senegal's "221" surviving a switch to the US as if it were area code
 * "221"). Falls back to treating all digits as national digits when
 * `fromIso2` isn't recognized. */
export function reformatForCountry(value: string, fromIso2: string, toIso2: string): string {
  if (!isSupportedCountry(toIso2)) return value;
  const digitsOnly = value.replace(/\D/g, "");
  const nationalDigits = isSupportedCountry(fromIso2) ? stripOwnDialCode(digitsOnly, fromIso2 as CountryCode) : digitsOnly;
  return truncateAndFormat(nationalDigits, toIso2 as CountryCode);
}

/** A callback number as typed by a member ("77 123 45 67", "+221771234567",
 * "00221 77…") → international format ("+221 77 123 45 67"), or null if it
 * isn't a valid number. Numbers without a country code are read as
 * `defaultCountry` — Senegal unless the member's own country says otherwise. */
export function normalizeCallbackPhone(raw: string, defaultCountry: string = "SN"): string | null {
  const cleaned = raw.trim().replace(/^00/, "+");
  if (!cleaned) return null;
  const country = isSupportedCountry(defaultCountry) ? (defaultCountry as CountryCode) : "SN";
  const parsed = parsePhoneNumberFromString(cleaned, country);
  return parsed?.isValid() ? parsed.formatInternational() : null;
}
