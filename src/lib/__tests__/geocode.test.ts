import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoordinateStatus } from "@/lib/enums";

// `src/lib/geocode.ts` keeps its throttle window in module-scope state
// (`lastRequestAt`), so every test needs a fresh module instance — otherwise
// the very first successful fetch in the file would throttle every test
// after it for 1.1s of real (or faked) time.
async function freshGeocodeModule() {
  vi.resetModules();
  return import("@/lib/geocode");
}

describe("geocodeIfMissing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes through supplied coordinates as UNCONFIRMED without calling fetch", async () => {
    const { geocodeIfMissing } = await freshGeocodeModule();

    const result = await geocodeIfMissing({
      line1: "1 Rue Test",
      city: "Dakar",
      countryName: "Senegal",
      latitude: 14.7,
      longitude: -17.4,
    });

    expect(result).toEqual({ latitude: 14.7, longitude: -17.4, coordinateStatus: CoordinateStatus.UNCONFIRMED });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("geocodes the address and marks it UNCONFIRMED when Nominatim returns a match", async () => {
    const { geocodeIfMissing } = await freshGeocodeModule();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ display_name: "1 Rue Test, Dakar, Senegal", lat: "14.71", lon: "-17.41" }]), { status: 200 }),
    );

    const result = await geocodeIfMissing({ line1: "1 Rue Test", city: "Dakar", countryName: "Senegal" });

    expect(result).toEqual({ latitude: 14.71, longitude: -17.41, coordinateStatus: CoordinateStatus.UNCONFIRMED });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [calledUrl] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(String(calledUrl)).searchParams.get("q")).toBe("1 Rue Test, Dakar, Senegal");
  });

  it("falls back to MISSING when Nominatim has no match", async () => {
    const { geocodeIfMissing } = await freshGeocodeModule();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const result = await geocodeIfMissing({ line1: "Nowhere", city: "Nowhere", countryName: "Nowhere" });

    expect(result).toEqual({ coordinateStatus: CoordinateStatus.MISSING });
  });

  it("falls back to MISSING (not an error) when the upstream request fails", async () => {
    const { geocodeIfMissing } = await freshGeocodeModule();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    const result = await geocodeIfMissing({ line1: "1 Rue Test", city: "Dakar", countryName: "Senegal" });

    expect(result).toEqual({ coordinateStatus: CoordinateStatus.MISSING });
  });

  it("does not call fetch at all for a query shorter than the minimum length", async () => {
    const { geocodeIfMissing } = await freshGeocodeModule();

    const result = await geocodeIfMissing({ line1: "A", city: "", countryName: "" });

    expect(result).toEqual({ coordinateStatus: CoordinateStatus.MISSING });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("searchAddress throttling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws GeocodeThrottledError for a second call within the throttle window", async () => {
    const { searchAddress, GeocodeThrottledError } = await freshGeocodeModule();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await searchAddress("Dakar, Senegal");
    await expect(searchAddress("Rufisque, Senegal")).rejects.toBeInstanceOf(GeocodeThrottledError);
  });

  it("returns an empty array for a too-short query without calling fetch", async () => {
    const { searchAddress } = await freshGeocodeModule();

    const results = await searchAddress("ab");

    expect(results).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
