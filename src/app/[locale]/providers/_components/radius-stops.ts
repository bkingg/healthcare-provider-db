/** The distance-from-point slider's stops: every km from 1 to 10 for local
 * searches, then 20km and 100km for wider ones. A stepped scale rather
 * than a linear 1–100 slider, where every practical local value would be
 * an imprecise sliver at the very bottom. */
export const RADIUS_STOPS_KM = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 100] as const;

export const DEFAULT_RADIUS_KM = 10;

/** Stops labelled under the slider. */
export const LABELLED_RADIUS_STOPS_KM: readonly number[] = [1, 10, 20, 100];

/** Index of the stop closest to `km`. A radius from the map's freehand
 * circle tool (any value, e.g. 3.7km or 250km) snaps to the nearest stop,
 * so the slider always shows a position it can actually represent. */
export function nearestRadiusStopIndex(km: number): number {
  let best = 0;
  for (let i = 1; i < RADIUS_STOPS_KM.length; i++) {
    if (Math.abs(RADIUS_STOPS_KM[i] - km) < Math.abs(RADIUS_STOPS_KM[best] - km)) best = i;
  }
  return best;
}
