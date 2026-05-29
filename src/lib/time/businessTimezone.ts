/**
 * Canonical business timezone helpers for Fizza school transport (Asia/Riyadh).
 */

import type { TripStatus } from '../trips/tripLifecycle.ts';

export const BUSINESS_TZ = 'Asia/Riyadh';

/** Riyadh is UTC+3 year-round (no DST). */
const RIYADH_UTC_OFFSET_HOURS = 3;

const TERMINAL_STATUSES = new Set<TripStatus>(['COMPLETED', 'CANCELLED', 'NO_SHOW']);

const ACTIVE_STATUSES = new Set<TripStatus>([
  'PRE_TRIP',
  'ON_THE_WAY',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'EN_ROUTE_DROPOFF',
  'ARRIVED_DROPOFF',
]);

const UPCOMING_STATUSES = new Set<TripStatus>(['DRIVER_ASSIGNED', 'PRE_TRIP']);

export type BusinessTripLike = {
  status: string;
  scheduledDate: string;
  scheduledPickupTime?: string | null;
};

export function getBusinessDateKey(date: Date, timeZone = BUSINESS_TZ): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}

export function getBusinessDayRange(dateKey: string): { startMs: number; endMs: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const startMs = Date.UTC(y!, m! - 1, d!, -RIYADH_UTC_OFFSET_HOURS, 0, 0, 0);
  const endMs = Date.UTC(y!, m! - 1, d!, 23 - RIYADH_UTC_OFFSET_HOURS, 59, 59, 999);
  return { startMs, endMs };
}

export function isSameBusinessDay(
  a: Date | string,
  b: Date | string,
  timeZone = BUSINESS_TZ,
): boolean {
  const aKey = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a)
    ? a
    : getBusinessDateKey(new Date(a), timeZone);
  const bKey = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b)
    ? b
    : getBusinessDateKey(new Date(b), timeZone);
  return aKey === bKey;
}

export function getTripBusinessDateKey(
  trip: Pick<BusinessTripLike, 'scheduledDate' | 'scheduledPickupTime'>,
  timeZone = BUSINESS_TZ,
): string {
  if (trip.scheduledPickupTime) {
    return getBusinessDateKey(new Date(trip.scheduledPickupTime), timeZone);
  }
  const raw = trip.scheduledDate;
  const normalized = raw.includes('T') ? raw : `${raw.split('T')[0]}T12:00:00.000Z`;
  return getBusinessDateKey(new Date(normalized), timeZone);
}

export function isTripTerminal(trip: Pick<BusinessTripLike, 'status'>): boolean {
  return TERMINAL_STATUSES.has(trip.status as TripStatus);
}

export function isTripActiveStatus(trip: Pick<BusinessTripLike, 'status'>): boolean {
  return ACTIVE_STATUSES.has(trip.status as TripStatus);
}

export function isTripStaleNonTerminal(
  trip: BusinessTripLike,
  now: Date | number = Date.now(),
): boolean {
  if (isTripTerminal(trip)) return false;

  const nowDate = typeof now === 'number' ? new Date(now) : now;
  const todayKey = getBusinessDateKey(nowDate);
  const tripKey = getTripBusinessDateKey(trip);

  if (tripKey < todayKey) return true;

  if (tripKey === todayKey) {
    const status = trip.status as TripStatus;
    if (UPCOMING_STATUSES.has(status) && trip.scheduledPickupTime) {
      const pickupMs = new Date(trip.scheduledPickupTime).getTime();
      if (Number.isFinite(pickupMs) && pickupMs < nowDate.getTime()) {
        return true;
      }
    }
  }

  return false;
}

export function explainStaleTripReason(trip: BusinessTripLike): string {
  const status = trip.status as TripStatus;
  const todayKey = getBusinessDateKey(new Date());
  const tripKey = getTripBusinessDateKey(trip);

  if (tripKey < todayKey) {
    if (isTripActiveStatus(trip)) {
      return 'Trip left open from a previous day — admin review required.';
    }
    if (status === 'DRIVER_ASSIGNED' || status === 'PRE_TRIP') {
      return 'Missed pickup — trip never started on its scheduled day.';
    }
    return 'Past scheduled date with no terminal status — admin review required.';
  }

  if (status === 'DRIVER_ASSIGNED' || status === 'PRE_TRIP') {
    return 'Missed pickup window today — contact dispatch or admin.';
  }

  return 'Trip needs review — contact dispatch or admin.';
}

export function parseBusinessLocalTime(timeStr: string, dateKey: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const [y, mo, d] = dateKey.split('-').map(Number);
  const utcMs = Date.UTC(y!, mo! - 1, d!, (h ?? 0) - RIYADH_UTC_OFFSET_HOURS, m ?? 0, 0, 0);
  return new Date(utcMs);
}

export function formatBusinessTime(iso: string | null, timeZone = BUSINESS_TZ): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-SA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTripDateTimeInBusinessTz(
  trip: Pick<BusinessTripLike, 'scheduledDate' | 'scheduledPickupTime'>,
  now: Date = new Date(),
  timeZone = BUSINESS_TZ,
): string {
  const todayKey = getBusinessDateKey(now, timeZone);
  const tomorrowKey = addDaysToBusinessDateKey(todayKey, 1, timeZone);
  const tripKey = getTripBusinessDateKey(trip, timeZone);
  const timeLabel = formatBusinessTime(trip.scheduledPickupTime ?? null, timeZone);

  if (tripKey === todayKey) return timeLabel;
  if (tripKey === tomorrowKey) return `Tomorrow · ${timeLabel}`;

  const dt = trip.scheduledDate.includes('T')
    ? new Date(trip.scheduledDate)
    : new Date(`${trip.scheduledDate.split('T')[0]}T12:00:00.000Z`);
  const dateLabel = dt.toLocaleDateString('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${dateLabel} · ${timeLabel}`;
}

export function addDaysToBusinessDateKey(
  dateKey: string,
  days: number,
  timeZone = BUSINESS_TZ,
): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + days, 12, 0, 0);
  return getBusinessDateKey(new Date(utc), timeZone);
}

export function scheduledDateKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
