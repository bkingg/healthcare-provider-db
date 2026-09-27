import { describe, expect, it } from "vitest";
import { circleBounds, haversineDistanceKm } from "../geo-math";

describe("haversineDistanceKm", () => {
  it("is zero for the same point", () => {
    expect(haversineDistanceKm({ lat: 14.7, lng: -17.4 }, { lat: 14.7, lng: -17.4 })).toBeCloseTo(0, 6);
  });

  it("matches a known distance: Dakar to Rufisque (~24km)", () => {
    // Dakar city center vs. Rufisque city center.
    const dakar = { lat: 14.6928, lng: -17.4467 };
    const rufisque = { lat: 14.7167, lng: -17.2667 };
    const km = haversineDistanceKm(dakar, rufisque);
    expect(km).toBeGreaterThan(18);
    expect(km).toBeLessThan(22);
  });

  it("is symmetric", () => {
    const a = { lat: 14.7, lng: -17.4 };
    const b = { lat: 15.0, lng: -16.9 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 9);
  });

  it("matches a known quarter-Earth-circumference-ish distance: equator to pole is ~10,000km", () => {
    const km = haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 90, lng: 0 });
    expect(km).toBeGreaterThan(9900);
    expect(km).toBeLessThan(10100);
  });
});

describe("circleBounds", () => {
  it("encloses the circle: each edge is radiusKm from the center", () => {
    const center = { lat: 14.6928, lng: -17.4467 };
    const [[south, west], [north, east]] = circleBounds(center, 10);
    expect(haversineDistanceKm(center, { lat: north, lng: center.lng })).toBeCloseTo(10, 1);
    expect(haversineDistanceKm(center, { lat: south, lng: center.lng })).toBeCloseTo(10, 1);
    expect(haversineDistanceKm(center, { lat: center.lat, lng: east })).toBeCloseTo(10, 1);
    expect(haversineDistanceKm(center, { lat: center.lat, lng: west })).toBeCloseTo(10, 1);
  });
});

describe("starting area (Dakar–Rufisque)", () => {
  it("contains Dakar and Rufisque, not Thiès or Saint-Louis", async () => {
    const { HOME_BOUNDS, isInBounds } = await import("../geo-math");
    expect(isInBounds({ lat: 14.6928, lng: -17.4467 }, HOME_BOUNDS)).toBe(true); // Dakar
    expect(isInBounds({ lat: 14.7167, lng: -17.2667 }, HOME_BOUNDS)).toBe(true); // Rufisque
    expect(isInBounds({ lat: 14.791, lng: -16.9359 }, HOME_BOUNDS)).toBe(false); // Thiès
    expect(isInBounds({ lat: 16.0326, lng: -16.4818 }, HOME_BOUNDS)).toBe(false); // Saint-Louis
  });
  it("opens there unless every result is elsewhere", async () => {
    const { showHomeArea } = await import("../geo-math");
    expect(showHomeArea([])).toBe(true);
    expect(showHomeArea([{ lat: 14.69, lng: -17.44 }, { lat: 16.03, lng: -16.48 }])).toBe(true);
    expect(showHomeArea([{ lat: 16.03, lng: -16.48 }])).toBe(false);
  });
});
