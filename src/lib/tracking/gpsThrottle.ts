/**
 * Server-side GPS write throttle.
 *
 * Drivers' clients already aim for ~10s update intervals, but flaky clients,
 * retries, or future native apps can send far more often. This caps how often
 * a single trip's location is persisted, protecting the database from write
 * spam without losing meaningful position accuracy.
 *
 * IMPORTANT — PRODUCTION LIMITATION:
 *   This is an in-memory, per-instance throttle. On a multi-instance / serverless
 *   deployment (e.g. Vercel) each instance keeps its own map, so the effective
 *   throttle window is per-instance, not global. For a globally consistent
 *   throttle, back this with Redis/Upstash (SETNX + PEXPIRE). The current
 *   implementation is correct and safe for single-instance deployments and is a
 *   strict improvement everywhere (it never drops a needed write incorrectly —
 *   only de-duplicates rapid bursts seen by the same instance).
 *
 * Safety: throttling only decides whether to PERSIST a location. It runs AFTER
 * all auth, ownership, and location-sharing checks, so it never weakens security.
 */

const GPS_THROTTLE_MS = Number(process.env.GPS_THROTTLE_MS ?? 4000);
const MAX_ENTRIES = 50_000;

const lastWriteByTrip = new Map<string, number>();

/** Returns true when the trip's last persisted location is within the cooldown window. */
export function shouldThrottleGps(tripId: string, now: number = Date.now()): boolean {
  const last = lastWriteByTrip.get(tripId);
  return last !== undefined && now - last < GPS_THROTTLE_MS;
}

/** Records that a location was persisted for this trip (resets the cooldown). */
export function recordGpsWrite(tripId: string, now: number = Date.now()): void {
  lastWriteByTrip.set(tripId, now);

  // Bound memory: when the map grows large, drop entries older than the window.
  if (lastWriteByTrip.size > MAX_ENTRIES) {
    for (const [key, ts] of lastWriteByTrip) {
      if (now - ts >= GPS_THROTTLE_MS) lastWriteByTrip.delete(key);
    }
  }
}

/** Test-only helper to reset throttle state between cases. */
export function __resetGpsThrottle(): void {
  lastWriteByTrip.clear();
}

export { GPS_THROTTLE_MS };
