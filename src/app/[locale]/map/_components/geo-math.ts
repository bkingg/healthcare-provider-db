const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometers. Used by
 * the "circle to find" tool to turn a center-click + edge-click into the
 * radiusKm this app's existing distance filter already understands (see
 * ST_DWithin in src/data/search.ts) — no new backend geometry needed, this
 * just computes the one number the existing filter takes. */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** South-west and north-east corners of the box enclosing a circle — lets
 * the map frame a distance-from-point search's whole circle (and so its
 * center point) even when no provider falls inside it. Flat-earth
 * approximation, which is plenty for framing a viewport at search radii. */
export function circleBounds(center: { lat: number; lng: number }, radiusKm: number): [[number, number], [number, number]] {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  return [
    [center.lat - dLat, center.lng - dLng],
    [center.lat + dLat, center.lng + dLng],
  ];
}
