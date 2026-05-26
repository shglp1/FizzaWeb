/** Map places registry configuration — server-safe env reads. */

export function getLocalPlaceSnapRadiusMeters(): number {
  const n = Number(process.env.MAP_LOCAL_PLACE_SNAP_RADIUS_METERS ?? '250');
  if (!Number.isFinite(n) || n <= 0) return 250;
  return Math.min(2000, Math.max(50, Math.round(n)));
}

export const MAP_PLACE_DEDUPE_METERS = 75;
