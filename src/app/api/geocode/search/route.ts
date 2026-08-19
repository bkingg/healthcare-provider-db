import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { GeocodeThrottledError, searchAddress } from "@/lib/geocode";

/**
 * Thin HTTP wrapper around `src/lib/geocode.ts::searchAddress` — the actual
 * Nominatim-calling + throttling logic lives there so it can also be called
 * directly (no HTTP round-trip to this route) from server-side geocode-on-save
 * (`geocodeIfMissing`, used by address create/update and CSV import commit).
 *
 * Backs the "Distance from point" address typeahead (`distance-filter.tsx`)
 * and the map's own address search box — same request/response contract as
 * before this refactor.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const results = await searchAddress(q);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof GeocodeThrottledError) {
      // Rather than queueing (which would just move the wait onto the next
      // keystroke's request), tell the client to back off; it already has a
      // debounce timer that will naturally try again shortly.
      return NextResponse.json({ results: [], throttled: true }, { status: 429 });
    }
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
