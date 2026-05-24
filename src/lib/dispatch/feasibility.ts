/**
 * Dispatch feasibility — can a driver complete trip A and reach trip B on time?
 */
import { haversineMetres } from '../trips/tripLifecycle.ts';
import { estimateDurationMinutesFallback, getDrivingDurationMinutes } from '../maps/distance.ts';
import type { DispatchConfig, FeasibilityIssue, FeasibilityResult, TimelineTrip } from './types';

function pickupMs(trip: TimelineTrip): number {
  return trip.scheduledPickupTime?.getTime() ?? 0;
}

export function estimateLegDurationMinutes(trip: TimelineTrip, config: DispatchConfig): number {
  if (trip.legDurationMinutes != null && trip.legDurationMinutes > 0) {
    return trip.legDurationMinutes;
  }
  if (trip.scheduledPickupTime && trip.scheduledDropoffTime) {
    const mins = (trip.scheduledDropoffTime.getTime() - trip.scheduledPickupTime.getTime()) / 60_000;
    if (mins > 0) return mins;
  }
  if (
    trip.pickupLat != null && trip.pickupLng != null &&
    trip.dropoffLat != null && trip.dropoffLng != null
  ) {
    const dist = haversineMetres(trip.pickupLat, trip.pickupLng, trip.dropoffLat, trip.dropoffLng);
    return estimateDurationMinutesFallback(dist, config.averageFallbackSpeedKmh);
  }
  return config.defaultLegDurationMinutes;
}

export function estimateTravelMinutesSync(
  from: TimelineTrip,
  to: TimelineTrip,
  config: DispatchConfig,
): number {
  if (
    from.dropoffLat != null && from.dropoffLng != null &&
    to.pickupLat != null && to.pickupLng != null
  ) {
    const dist = haversineMetres(from.dropoffLat, from.dropoffLng, to.pickupLat, to.pickupLng);
    return estimateDurationMinutesFallback(dist, config.averageFallbackSpeedKmh);
  }
  return config.defaultTravelMinutesNoCoords;
}

export function resolveTravelMinutes(input: {
  orsMinutes: number | null | undefined;
  haversineMinutes: number;
  noCoordsDefault: number;
  hasCoords: boolean;
}): number {
  if (!input.hasCoords) return input.noCoordsDefault;
  if (input.orsMinutes != null && input.orsMinutes > 0) return input.orsMinutes;
  return input.haversineMinutes;
}
export async function estimateTravelMinutes(
  from: TimelineTrip,
  to: TimelineTrip,
  config: DispatchConfig,
): Promise<number> {
  const hasCoords = from.dropoffLat != null && from.dropoffLng != null
    && to.pickupLat != null && to.pickupLng != null;

  if (!hasCoords) {
    return config.defaultTravelMinutesNoCoords;
  }

  const ors = await getDrivingDurationMinutes(
    { lat: from.dropoffLat!, lng: from.dropoffLng! },
    { lat: to.pickupLat!, lng: to.pickupLng! },
  );
  const haversine = estimateTravelMinutesSync(from, to, config);
  return resolveTravelMinutes({
    orsMinutes: ors?.durationMinutes,
    haversineMinutes: haversine,
    noCoordsDefault: config.defaultTravelMinutesNoCoords,
    hasCoords: true,
  });
}

function sortTimeline(trips: TimelineTrip[]): TimelineTrip[] {
  return [...trips].sort((a, b) => pickupMs(a) - pickupMs(b));
}

/** Sync feasibility check (haversine travel) — used in tests and fast paths. */
export function checkTimelineFeasibilitySync(
  trips: TimelineTrip[],
  config: DispatchConfig,
): FeasibilityResult {
  const sorted = sortTimeline(trips);
  const issues: FeasibilityIssue[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const prior = sorted[i];
    const next = sorted[i + 1];
    if (!prior.scheduledPickupTime || !next.scheduledPickupTime) continue;

    const legEnd = prior.scheduledPickupTime.getTime()
      + estimateLegDurationMinutes(prior, config) * 60_000;
    const travel = estimateTravelMinutesSync(prior, next, config) * 60_000;
    const readyAt = legEnd + travel + config.bufferMinutes * 60_000;

    if (readyAt > next.scheduledPickupTime.getTime()) {
      issues.push({
        priorTripId: prior.id,
        tripId: next.id,
        message: `Driver cannot reach next pickup in time (needs ${Math.ceil((readyAt - next.scheduledPickupTime.getTime()) / 60_000)} extra min)`,
      });
    }
  }

  return { feasible: issues.length === 0, issues };
}

/** Async feasibility with ORS when available. */
export async function checkTimelineFeasibility(
  trips: TimelineTrip[],
  config: DispatchConfig,
): Promise<FeasibilityResult> {
  const sorted = sortTimeline(trips);
  const issues: FeasibilityIssue[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const prior = sorted[i];
    const next = sorted[i + 1];
    if (!prior.scheduledPickupTime || !next.scheduledPickupTime) continue;

    const legEnd = prior.scheduledPickupTime.getTime()
      + estimateLegDurationMinutes(prior, config) * 60_000;
    const travel = (await estimateTravelMinutes(prior, next, config)) * 60_000;
    const readyAt = legEnd + travel + config.bufferMinutes * 60_000;

    if (readyAt > next.scheduledPickupTime.getTime()) {
      issues.push({
        priorTripId: prior.id,
        tripId: next.id,
        message: `Driver cannot reach next pickup in time (needs ${Math.ceil((readyAt - next.scheduledPickupTime.getTime()) / 60_000)} extra min)`,
      });
    }
  }

  return { feasible: issues.length === 0, issues };
}

/** Can a candidate trip be added to an existing driver day timeline? */
export async function canAddTripToTimeline(
  existing: TimelineTrip[],
  candidate: TimelineTrip,
  config: DispatchConfig,
): Promise<{ feasible: boolean; reason: string | null }> {
  const combined = [...existing, candidate];
  const result = await checkTimelineFeasibility(combined, config);
  if (result.feasible) return { feasible: true, reason: null };
  const issue = result.issues.find((i) => i.tripId === candidate.id);
  return { feasible: false, reason: issue?.message ?? result.issues[0]?.message ?? 'Timeline conflict' };
}
