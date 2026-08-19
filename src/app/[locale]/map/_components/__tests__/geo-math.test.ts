import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "../geo-math";

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
