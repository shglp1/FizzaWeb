/**
 * Driver trip selection, filtering, and counts — full datetime aware (Asia/Riyadh).
 */

import type { TripStatus } from '../trips/tripLifecycle.ts';
import {
  BUSINESS_TZ,
  addDaysToBusinessDateKey,
  explainStaleTripReason,
  getBusinessDateKey,
  getTripBusinessDateKey,
  isTripStaleNonTerminal,
} from '../time/businessTimezone.ts';

export const DRIVER_TIMEZONE = BUSINESS_TZ;

export const DRIVER_ACTIVE_STATUSES = new Set<TripStatus>([
  'PRE_TRIP',
  'ON_THE_WAY',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'EN_ROUTE_DROPOFF',
  'ARRIVED_DROPOFF',
]);

export const DRIVER_TERMINAL_STATUSES = new Set<TripStatus>([
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

export const DRIVER_UPCOMING_STATUSES = new Set<TripStatus>([
  'DRIVER_ASSIGNED',
  'PRE_TRIP',
]);

export type DriverTripLike = {
  id?: string;
  status: string;
  driverId?: string | null;
  scheduledDate: string;
  scheduledPickupTime?: string | null;
};

export function getTimezoneDateKey(date: Date, timeZone = DRIVER_TIMEZONE): string {
  return getBusinessDateKey(date, timeZone);
}

export function getTripDateKey(
  trip: Pick<DriverTripLike, 'scheduledDate' | 'scheduledPickupTime'>,
  timeZone = DRIVER_TIMEZONE,
): string {
  return getTripBusinessDateKey(trip, timeZone);
}

/** Resolve trip start instant — prefer scheduledPickupTime over date-only fallback. */
export function resolveTripStartMs(trip: Pick<DriverTripLike, 'scheduledPickupTime' | 'scheduledDate'>): number | null {
  if (trip.scheduledPickupTime) {
    const ms = new Date(trip.scheduledPickupTime).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (trip.scheduledDate) {
    const raw = trip.scheduledDate.split('T')[0]!;
    const ms = new Date(`${raw}T00:00:00.000Z`).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function isTripAssignedToDriver(
  trip: Pick<DriverTripLike, 'status' | 'driverId'>,
  currentDriverId?: string | null,
): boolean {
  if (currentDriverId) return trip.driverId === currentDriverId;
  if (trip.driverId) return true;
  return trip.status !== 'SCHEDULED';
}

export function filterDriverAssignedTrips<T extends DriverTripLike>(
  trips: T[],
  currentDriverId?: string | null,
): T[] {
  return trips.filter((trip) => isTripAssignedToDriver(trip, currentDriverId));
}

export function isDriverActiveTrip(trip: Pick<DriverTripLike, 'status'>): boolean {
  return DRIVER_ACTIVE_STATUSES.has(trip.status as TripStatus);
}

export function isDriverTerminalTrip(trip: Pick<DriverTripLike, 'status'>): boolean {
  return DRIVER_TERMINAL_STATUSES.has(trip.status as TripStatus);
}

export function partitionStaleTrips<T extends DriverTripLike>(
  trips: T[],
  nowMs = Date.now(),
): { normal: T[]; stale: T[] } {
  const normal: T[] = [];
  const stale: T[] = [];
  for (const trip of trips) {
    if (isTripStaleNonTerminal(trip, nowMs)) stale.push(trip);
    else normal.push(trip);
  }
  return { normal, stale };
}

/** Future upcoming assigned trip candidate (excludes past pickup times unless active). */
export function isDriverNextTripCandidate(
  trip: DriverTripLike,
  nowMs = Date.now(),
  currentDriverId?: string | null,
): boolean {
  if (!isTripAssignedToDriver(trip, currentDriverId)) return false;
  if (isTripStaleNonTerminal(trip, nowMs)) return false;
  if (isDriverTerminalTrip(trip)) return false;
  if (isDriverActiveTrip(trip)) return true;

  const status = trip.status as TripStatus;
  if (status === 'SCHEDULED') return false;

  if (!DRIVER_UPCOMING_STATUSES.has(status)) return false;

  const startMs = resolveTripStartMs(trip);
  if (startMs == null) return false;
  return startMs >= nowMs;
}

export function sortTripsByStartAsc<T extends DriverTripLike>(trips: T[]): T[] {
  return [...trips].sort((a, b) => {
    const aMs = resolveTripStartMs(a) ?? Number.MAX_SAFE_INTEGER;
    const bMs = resolveTripStartMs(b) ?? Number.MAX_SAFE_INTEGER;
    if (aMs !== bMs) return aMs - bMs;
    return (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
  });
}

export type DriverHeroTripKind = 'active' | 'today' | 'upcoming';

export type DriverHeroTripResult<T extends DriverTripLike> = {
  trip: T;
  kind: DriverHeroTripKind;
};

/** Non-stale active first, remaining today, then nearest future (tomorrow+). */
export function resolveDriverHeroTrip<T extends DriverTripLike>(
  trips: T[],
  nowMs = Date.now(),
  currentDriverId?: string | null,
): DriverHeroTripResult<T> | null {
  const assigned = filterDriverAssignedTrips(trips, currentDriverId);
  const { normal } = partitionStaleTrips(assigned, nowMs);
  const now = new Date(nowMs);
  const todayKey = getTimezoneDateKey(now);

  const active = normal.filter((t) => isDriverActiveTrip(t));
  if (active.length) {
    return { trip: sortTripsByStartAsc(active)[0]!, kind: 'active' };
  }

  const todayRemaining = normal.filter((t) => {
    if (getTripDateKey(t) !== todayKey) return false;
    if (isDriverTerminalTrip(t)) return false;
    if (isDriverActiveTrip(t)) return true;
    const startMs = resolveTripStartMs(t);
    return startMs != null && startMs >= nowMs;
  });
  if (todayRemaining.length) {
    return { trip: sortTripsByStartAsc(todayRemaining)[0]!, kind: 'today' };
  }

  const future = normal.filter((t) => isDriverNextTripCandidate(t, nowMs, currentDriverId));
  const nearestFuture = sortTripsByStartAsc(future)[0];
  if (nearestFuture) {
    return { trip: nearestFuture, kind: 'upcoming' };
  }

  return null;
}

/** Active trip first, else nearest future assigned trip by full datetime (excludes stale). */
export function pickNextDriverTrip<T extends DriverTripLike>(
  trips: T[],
  nowMs = Date.now(),
  currentDriverId?: string | null,
): T | null {
  return resolveDriverHeroTrip(trips, nowMs, currentDriverId)?.trip ?? null;
}

export type DriverTripCounts = {
  todayTotal: number;
  active: number;
  completedToday: number;
  remainingToday: number;
  upcoming: number;
  stale: number;
};

export function computeDriverTripCounts<T extends DriverTripLike>(
  trips: T[],
  nowMs = Date.now(),
  now = new Date(nowMs),
  timeZone = DRIVER_TIMEZONE,
  currentDriverId?: string | null,
): DriverTripCounts {
  const assigned = filterDriverAssignedTrips(trips, currentDriverId);
  const { normal, stale } = partitionStaleTrips(assigned, nowMs);
  const todayKey = getTimezoneDateKey(now, timeZone);
  const todayTrips = normal.filter((t) => getTripDateKey(t, timeZone) === todayKey);

  const active = normal.filter((t) => isDriverActiveTrip(t)).length;
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;

  const remainingToday = todayTrips.filter((t) => {
    if (isDriverTerminalTrip(t)) return false;
    if (isDriverActiveTrip(t)) return true;
    const startMs = resolveTripStartMs(t);
    return startMs != null && startMs >= nowMs;
  }).length;

  const upcoming = normal.filter((t) => isDriverNextTripCandidate(t, nowMs, currentDriverId)).length;

  return {
    todayTotal: todayTrips.length,
    active,
    completedToday,
    remainingToday,
    upcoming,
    stale: stale.length,
  };
}

export function filterTripsForLocalDate<T extends DriverTripLike>(
  trips: T[],
  dateKey: string,
  timeZone = DRIVER_TIMEZONE,
): T[] {
  return trips.filter((t) => getTripDateKey(t, timeZone) === dateKey);
}

export function addDaysToDateKey(dateKey: string, days: number, timeZone = DRIVER_TIMEZONE): string {
  return addDaysToBusinessDateKey(dateKey, days, timeZone);
}

export function getWeekDateRangeInTimezone(
  now = new Date(),
  timeZone = DRIVER_TIMEZONE,
): { from: string; to: string } {
  const from = getTimezoneDateKey(now, timeZone);
  const to = addDaysToDateKey(from, 6, timeZone);
  return { from, to };
}

export type NextTripExclusionReason =
  | 'not_assigned'
  | 'terminal'
  | 'scheduled_unassigned'
  | 'past_pickup'
  | 'invalid_status'
  | 'stale';

export function explainNextTripExclusion(
  trip: DriverTripLike,
  nowMs = Date.now(),
  currentDriverId?: string | null,
): NextTripExclusionReason | null {
  if (!isTripAssignedToDriver(trip, currentDriverId)) return 'not_assigned';
  if (isTripStaleNonTerminal(trip, nowMs)) return 'stale';
  if (isDriverTerminalTrip(trip)) return 'terminal';
  if (isDriverActiveTrip(trip)) return null;
  if ((trip.status as TripStatus) === 'SCHEDULED') return 'scheduled_unassigned';
  if (!DRIVER_UPCOMING_STATUSES.has(trip.status as TripStatus)) return 'invalid_status';
  const startMs = resolveTripStartMs(trip);
  if (startMs != null && startMs < nowMs) return 'past_pickup';
  return null;
}

export { explainStaleTripReason, isTripStaleNonTerminal };
