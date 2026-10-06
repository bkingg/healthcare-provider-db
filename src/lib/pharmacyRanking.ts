import { haversineKm } from "./distance";
import { isOpenAt, type OfficeHoursRow } from "./openNow";

/** Which pharmacies to ask first for a medication order (step 3). Never
 * DO NOT USE or inactive ones. Open now first, then nearest, then the ones
 * that answer most often and fastest. */

export type PharmacyCandidate = {
  id: string;
  status: string;
  isOpen24_7: boolean;
  officeHours: OfficeHoursRow[];
  lat: number | null;
  lng: number | null;
};

export type ResponseStats = { asked: number; answered: number; medianMinutes: number | null };

export type RankedPharmacy<P> = P & { openNow: boolean; distanceKm: number | null; answerRate: number | null; medianMinutes: number | null };

export function rankPharmacies<P extends PharmacyCandidate>(
  pharmacies: P[],
  deliveryPoint: { lat: number; lng: number } | null,
  now: Date,
  stats: Map<string, ResponseStats> = new Map(),
): RankedPharmacy<P>[] {
  return pharmacies
    .filter((p) => p.status === "ACTIVE")
    .map((p) => {
      const s = stats.get(p.id);
      return {
        ...p,
        openNow: isOpenAt(p, now),
        distanceKm: deliveryPoint && p.lat !== null && p.lng !== null ? Math.round(haversineKm(deliveryPoint, { lat: p.lat, lng: p.lng }) * 10) / 10 : null,
        answerRate: s && s.asked > 0 ? s.answered / s.asked : null,
        medianMinutes: s?.medianMinutes ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.openNow) - Number(a.openNow) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        (b.answerRate ?? -1) - (a.answerRate ?? -1) ||
        (a.medianMinutes ?? Infinity) - (b.medianMinutes ?? Infinity),
    );
}
