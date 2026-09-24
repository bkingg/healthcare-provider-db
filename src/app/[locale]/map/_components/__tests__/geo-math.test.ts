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
