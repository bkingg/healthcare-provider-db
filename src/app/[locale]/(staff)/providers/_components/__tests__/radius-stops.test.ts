import { describe, expect, it } from "vitest";
import { DEFAULT_RADIUS_KM, LABELLED_RADIUS_STOPS_KM, RADIUS_STOPS_KM, nearestRadiusStopIndex } from "../radius-stops";

describe("RADIUS_STOPS_KM", () => {
  it("runs 1–10km in 1km steps, then 20km, then 100km", () => {
    expect(RADIUS_STOPS_KM).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 100]);
  });

  it("includes the default and every labelled value", () => {
    expect(RADIUS_STOPS_KM).toContain(DEFAULT_RADIUS_KM);
    for (const km of LABELLED_RADIUS_STOPS_KM) expect(RADIUS_STOPS_KM).toContain(km as (typeof RADIUS_STOPS_KM)[number]);
  });
});

describe("nearestRadiusStopIndex", () => {
  it("finds exact stops", () => {
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(1)]).toBe(1);
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(20)]).toBe(20);
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(100)]).toBe(100);
  });

  it("snaps other radii (e.g. from the map's circle tool) to the closest stop", () => {
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(3.7)]).toBe(4);
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(14)]).toBe(10);
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(16)]).toBe(20);
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(0.2)]).toBe(1);
    expect(RADIUS_STOPS_KM[nearestRadiusStopIndex(250)]).toBe(100);
  });
});
