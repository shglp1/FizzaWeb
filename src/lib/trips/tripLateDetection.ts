/**
 * Automatic driver late detection rules (pure + DB runner).
 */
import type { TripStatus } from './tripLifecycle.ts';
import type { TripOpsConfig } from './tripConfig.ts';

const LATE_EXEMPT: TripStatus[] = [
  'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
  'COMPLETED', 'CANCELLED', 'NO_SHOW',
];

export type LateCandidate = {
  tripId: string;
  scheduledPickupTime: Date;
  status: TripStatus;
  minutesLate: number;
};

export function isTripLateForDriver(
  status: TripStatus,
  scheduledPickupTime: Date | null,
  nowMs: number,
  config: TripOpsConfig,
): boolean {
  if (!scheduledPickupTime) return false;
  if (LATE_EXEMPT.includes(status)) return false;
  const thresholdMs = config.driverLateAfterMinutes * 60 * 1000;
  return nowMs > scheduledPickupTime.getTime() + thresholdMs;
}

export function computeMinutesLate(scheduledPickupTime: Date, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - scheduledPickupTime.getTime()) / 60_000));
}

/** Active pre-pickup statuses eligible for late detection. */
export const LATE_CHECK_STATUSES: TripStatus[] = [
  'SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
];

export function buildLateCandidate(
  trip: { id: string; status: string; scheduledPickupTime: Date | null },
  nowMs: number,
  config: TripOpsConfig,
): LateCandidate | null {
  if (!trip.scheduledPickupTime) return null;
  const status = trip.status as TripStatus;
  if (!isTripLateForDriver(status, trip.scheduledPickupTime, nowMs, config)) return null;
  return {
    tripId: trip.id,
    scheduledPickupTime: trip.scheduledPickupTime,
    status,
    minutesLate: computeMinutesLate(trip.scheduledPickupTime, nowMs),
  };
}
