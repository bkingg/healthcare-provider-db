import "server-only";
import { CoordinateStatus } from "@/lib/enums";

/**
 * Shared OpenStreetMap/Nominatim geocoding — the one place this app talks to
 * an external geocoder, used by:
 *   - `src/app/api/geocode/search/route.ts` (thin wrapper), backing the
 *     "Distance from point" address typeahead and the map's own search box.
 *   - `geocodeIfMissing` below, called server-side (no HTTP round-trip to our
 *     own route) whenever an address is created, updated, or imported
 *     without explicit coordinates.
 *
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 *   1. Requires a descriptive User-Agent identifying the calling application.
 *   2. Caps usage at ~1 request/second. MIN_INTERVAL_MS enforces that across
 *      every caller in this process — typeahead keystrokes *and* background
 *      geocode-on-save — so combined load doesn't get this server's IP
 *      rate-limited or blocked by the free public instance. Fine for the
 *      internal/low-traffic use this was chosen for; a production rollout
 *      with heavier traffic should move to a dedicated provider (self-hosted
 *      Nominatim, Photon, or a paid geocoder) instead of raising this limit.
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "healthcare-provider-db/1.0 (internal tool; contact: system@seed.local)";
const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 5;
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  /** Structured components from Nominatim's `addressdetails=1`, used to
   * autofill the Address form's City/State/Postal/Country fields instead of
   * staff retyping them from the free-text `label` — see the address search
   * typeahead in addresses-section.tsx. Nominatim only returns whichever of
   * these apply to the matched place, so every field is optional; the form
   * only overwrites a field when a value is actually present. */
  line1?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, upper-cased to match CountryRef.iso2 (Nominatim
   * returns it lower-case). */
  countryIso2?: string;
  /** Full country name, present alongside countryIso2 whenever Nominatim
   * resolves one — used to auto-create a CountryRef row (matched/deduped by
   * iso2, see findOrCreateCountry) when the picked address is in a country
   * this app doesn't have on file yet. */
  countryName?: string;
};

/** Nominatim's `addressdetails=1` response shape — only the fields this app
 * reads; the full response has many more, city/state-equivalent naming in
 * particular varies a lot by place type and country (see
 * https://nominatim.org/release-docs/latest/api/Output/#addressdetails). */
type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  state?: string;
  state_district?: string;
  region?: string;
  county?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

export class GeocodeThrottledError extends Error {}
export class GeocodeUpstreamError extends Error {}

/** Raw Nominatim search — throws GeocodeThrottledError/GeocodeUpstreamError
 * rather than swallowing failures, so callers (the HTTP route vs. the
 * geocode-on-save path below) can each decide how to surface them. */
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) {
    throw new GeocodeThrottledError("Geocoding requests are throttled; try again shortly.");
  }
  lastRequestAt = now;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("addressdetails", "1");

  let response: Response;
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" } });
  } catch (cause) {
    throw new GeocodeUpstreamError("Failed to reach the geocoding service.", { cause });
  }
  if (!response.ok) {
    throw new GeocodeUpstreamError(`Geocoding service returned ${response.status}`);
  }

  const data = (await response.json()) as { display_name: string; lat: string; lon: string; address?: NominatimAddress }[];
  return data.map((r) => {
    const a = r.address ?? {};
    const line1 = [a.house_number, a.road].filter(Boolean).join(" ") || undefined;
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality;
    const stateProvince = a.state ?? a.state_district ?? a.region ?? a.county;
    return {
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      line1,
      city,
      stateProvince,
      postalCode: a.postcode,
      countryIso2: a.country_code?.toUpperCase(),
      countryName: a.country,
    };
  });
}

export type GeocodeIfMissingInput = {
  line1: string;
  city: string;
  stateProvince?: string;
  postalCode?: string;
  countryName: string;
  latitude?: number;
  longitude?: number;
};

export type GeocodeIfMissingResult = {
  latitude?: number;
  longitude?: number;
  coordinateStatus: CoordinateStatus;
};

/** Called from the Address create/update DAL and from the import commit
 * step. Manually-supplied coordinates are trusted but marked UNCONFIRMED
 * (matching the existing CSV-import convention in `validateRow.ts` — a
 * human/spreadsheet-supplied point still needs a steward's visual check).
 * Missing coordinates get a best-effort geocode of the address text; a
 * throttled or failed lookup falls back to MISSING rather than blocking the
 * save — the record can be re-geocoded later via edit or a future retry. */
export async function geocodeIfMissing(input: GeocodeIfMissingInput): Promise<GeocodeIfMissingResult> {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { latitude: input.latitude, longitude: input.longitude, coordinateStatus: CoordinateStatus.UNCONFIRMED };
  }

  const query = [input.line1, input.city, input.stateProvince, input.postalCode, input.countryName].filter(Boolean).join(", ");

  try {
    const [top] = await searchAddress(query);
    if (top) {
      return { latitude: top.lat, longitude: top.lng, coordinateStatus: CoordinateStatus.UNCONFIRMED };
    }
  } catch {
    // Throttled or upstream failure — treat the same as "no match found."
  }
  return { coordinateStatus: CoordinateStatus.MISSING };
}
