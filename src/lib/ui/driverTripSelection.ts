/**
 * Driver trip selection, filtering, and counts — full datetime aware (Asia/Riyadh).
 */

import type { TripStatus } from '../trips/tripLifecycle.ts';

export const DRIVER_TIMEZONE = 'Asia/Riyadh';

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
  return date.toLocaleDateString('en-CA', { timeZone });
}

export function getTripDateKey(
  trip: Pick<DriverTripLike, 'scheduledDate'>,
  timeZone = DRIVER_TIMEZONE,
): string {
  const raw = trip.scheduledDate;
  const normalized = raw.includes('T') ? raw : `${raw.split('T')[0]}T12:00:00.000Z`;
  return getTimezoneDateKey(new Date(normalized), timeZone);
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

/** Future upcoming assigned trip candidate (excludes past pickup times unless active). */
export function isDriverNextTripCandidate(
  trip: DriverTripLike,
  nowMs = Date.now(),
  currentDriverId?: string | null,
): boolean {
  if (!isTripAssignedToDriver(trip, currentDriverId)) return false;
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

/** Active trip first, else nearest future assigned trip by full datetime. */
export function pickNextDriverTrip<T extends DriverTripLike>(
  trips: T[],
  nowMs = Date.now(),
  currentDriverId?: string | null,
): T | null {
  const assigned = filterDriverAssignedTrips(trips, currentDriverId);
  const active = assigned.filter((t) => isDriverActiveTrip(t));
  if (active.length) return sortTripsByStartAsc(active)[0] ?? null;

  const upcoming = assigned.filter((t) => isDriverNextTripCandidate(t, nowMs, currentDriverId));
  return sortTripsByStartAsc(upcoming)[0] ?? null;
}

export type DriverTripCounts = {
  todayTotal: number;
  active: number;
  completedToday: number;
  remainingToday: number;
  upcoming: number;
};

export function computeDriverTripCounts<T extends DriverTripLike>(
  trips: T[],
  nowMs = Date.now(),
  now = new Date(nowMs),
  timeZone = DRIVER_TIMEZONE,
  currentDriverId?: string | null,
): DriverTripCounts {
  const assigned = filterDriverAssignedTrips(trips, currentDriverId);
  const todayKey = getTimezoneDateKey(now, timeZone);
  const todayTrips = assigned.filter((t) => getTripDateKey(t, timeZone) === todayKey);

  const active = assigned.filter((t) => isDriverActiveTrip(t)).length;
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;

  const remainingToday = todayTrips.filter((t) => {
    if (isDriverTerminalTrip(t)) return false;
    if (isDriverActiveTrip(t)) return true;
    const startMs = resolveTripStartMs(t);
    return startMs != null && startMs >= nowMs;
  }).length;

  const upcoming = assigned.filter((t) => isDriverNextTripCandidate(t, nowMs, currentDriverId)).length;

  return {
    todayTotal: todayTrips.length,
    active,
    completedToday,
    remainingToday,
    upcoming,
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
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + days, 12, 0, 0);
  return getTimezoneDateKey(new Date(utc), timeZone);
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
  | 'invalid_status';

export function explainNextTripExclusion(
  trip: DriverTripLike,
  nowMs = Date.now(),
  currentDriverId?: string | null,
): NextTripExclusionReason | null {
  if (!isTripAssignedToDriver(trip, currentDriverId)) return 'not_assigned';
  if (isDriverTerminalTrip(trip)) return 'terminal';
  if (isDriverActiveTrip(trip)) return null;
  if ((trip.status as TripStatus) === 'SCHEDULED') return 'scheduled_unassigned';
  if (!DRIVER_UPCOMING_STATUSES.has(trip.status as TripStatus)) return 'invalid_status';
  const startMs = resolveTripStartMs(trip);
  if (startMs != null && startMs < nowMs) return 'past_pickup';
  return null;
}
