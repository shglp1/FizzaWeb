/** Pure location distance helpers — testable without DOM. */

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in meters between two WGS84 points. */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** True when pickup and drop-off are within threshold meters (default 100m). */
export function locationsWithinMeters(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined,
  thresholdM = 100,
): boolean {
  if (!a || !b) return false;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return false;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return false;
  return haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng) < thresholdM;
}
