/**
 * Shared enterprise trip classification — Asia/Riyadh business day aware.
 * Used by driver, parent, admin, dispatch, and payroll eligibility surfaces.
 */

import type { TripStatus } from './tripLifecycle.ts';
import { isActiveStatus, isTrackableStatus } from './tripLifecycle.ts';
import {
  BUSINESS_TZ,
  addDaysToBusinessDateKey,
  explainStaleTripReason,
  getBusinessDateKey,
  getTripBusinessDateKey,
  isTripStaleNonTerminal,
  isTripTerminal,
  isTripActiveStatus,
} from '../time/businessTimezone.ts';

export type TripRole = 'DRIVER' | 'PARENT' | 'ADMIN';

export type TripCategory =
  | 'active'
  | 'today'
  | 'upcoming'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'stale'
  | 'needs_dispatch'
  | 'missed_pickup'
  | 'scheduled'
  | 'terminal';

export type EarningsEligibility = 'payable' | 'not_payable' | 'needs_financial_review';

export type TrackingGroupKey = 'available_now' | 'opens_soon' | 'upcoming' | 'needs_review';

export type ClassifiableTrip = {
  status: string;
  scheduledDate: string;
  scheduledPickupTime?: string | null;
  needsDispatch?: boolean;
  driverId?: string | null;
  financialReviewStatus?: string | null;
};

export type TripClassification = {
  category: TripCategory;
  businessDateKey: string;
  displayLabel: string;
  isStale: boolean;
  isTerminal: boolean;
  isActive: boolean;
  shouldShowInToday: boolean;
  shouldShowInUpcoming: boolean;
  shouldShowInLiveTracking: boolean;
  needsAdminReview: boolean;
  earningsEligibility: EarningsEligibility;
  trackingGroup: TrackingGroupKey;
  staleReason: string | null;
  minutesUntilPickup: number | null;
};

const UPCOMING_STATUSES = new Set<TripStatus>(['DRIVER_ASSIGNED', 'PRE_TRIP']);

function normalizeTrip(trip: ClassifiableTrip): ClassifiableTrip {
  return {
    ...trip,
    scheduledDate: trip.scheduledDate.includes('T')
      ? trip.scheduledDate
      : `${trip.scheduledDate.split('T')[0]}T12:00:00.000Z`,
  };
}

export function resolveTripStartMs(trip: Pick<ClassifiableTrip, 'scheduledPickupTime' | 'scheduledDate'>): number | null {
  if (trip.scheduledPickupTime) {
    const ms = new Date(trip.scheduledPickupTime).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (trip.scheduledDate) {
    const raw = trip.scheduledDate.split('T')[0]!;
    return new Date(`${raw}T00:00:00.000Z`).getTime();
  }
  return null;
}

export function minutesUntilPickup(
  scheduledPickupTime: string | null | undefined,
  nowMs = Date.now(),
): number | null {
  if (!scheduledPickupTime) return null;
  return Math.round((new Date(scheduledPickupTime).getTime() - nowMs) / 60_000);
}

/** Payroll / earnings eligibility from trip status + admin financial review decision. */
export function resolveEarningsEligibility(
  trip: ClassifiableTrip,
  status: TripStatus,
  isStale: boolean,
): EarningsEligibility {
  if (status !== 'COMPLETED') {
    if (isStale) return 'needs_financial_review';
    return 'not_payable';
  }
  const review = trip.financialReviewStatus;
  if (review === 'PENDING') return 'needs_financial_review';
  if (review === 'NO_PAY_DRIVER') return 'not_payable';
  if (review === 'REFUND_PARENT' || review === 'CREDIT_PARENT') return 'not_payable';
  if (review === 'INCIDENT') return 'not_payable';
  if (review === 'PAY_DRIVER' || review === 'KEEP_REVENUE') return 'payable';
  if (isStale) return 'needs_financial_review';
  return 'payable';
}

/** Human-readable skip reason for payroll generation reports. */
export function getPayrollSkipReason(trip: ClassifiableTrip, nowMs = Date.now()): string {
  const c = classifyTripForRole(trip, { role: 'ADMIN', nowMs });
  if (c.earningsEligibility === 'payable') return '';

  const review = trip.financialReviewStatus;
  if (review === 'PENDING') return 'Financial review pending — resolve in Trip Operations';
  if (review === 'NO_PAY_DRIVER') return 'Admin decision: do not pay driver';
  if (review === 'REFUND_PARENT') return 'Admin decision: refund parent — driver payout withheld';
  if (review === 'CREDIT_PARENT') return 'Admin decision: credit parent — driver payout withheld';
  if (review === 'INCIDENT') return 'Admin decision: incident — driver payout withheld';
  if (c.isStale) return 'Stale or disputed trip — requires financial review';
  if (trip.status !== 'COMPLETED') return 'Trip not completed';
  return 'Not eligible for payroll';
}

function resolveTrackingGroup(
  trip: ClassifiableTrip,
  status: TripStatus,
  isStale: boolean,
  mins: number | null,
  nowMs: number,
  timeZone = BUSINESS_TZ,
): TrackingGroupKey {
  if (isStale) return 'needs_review';
  if (status === 'SCHEDULED') return 'needs_review';

  const todayKey = getBusinessDateKey(new Date(nowMs), timeZone);
  const tripKey = getTripBusinessDateKey(trip, timeZone);

  if (isTrackableStatus(status)) return 'available_now';

  if (tripKey === todayKey) {
    if (mins != null && mins > 10 && UPCOMING_STATUSES.has(status)) return 'opens_soon';
    if (mins != null && mins <= 10 && mins >= 0 && UPCOMING_STATUSES.has(status)) return 'available_now';
    if (mins != null && mins < 0 && UPCOMING_STATUSES.has(status)) return 'needs_review';
  }

  if (tripKey > todayKey) return 'upcoming';

  return 'needs_review';
}

function categoryDisplayLabel(category: TripCategory): string {
  switch (category) {
    case 'active': return 'Active now';
    case 'today': return 'Today';
    case 'upcoming': return 'Upcoming';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'no_show': return 'No show';
    case 'stale': return 'Needs review';
    case 'needs_dispatch': return 'Needs dispatch';
    case 'missed_pickup': return 'Missed pickup';
    case 'scheduled': return 'Scheduled';
    case 'terminal': return 'Closed';
    default: return category;
  }
}

export function classifyTripForRole(
  rawTrip: ClassifiableTrip,
  options: {
    role: TripRole;
    nowMs?: number;
    timeZone?: string;
  },
): TripClassification {
  const trip = normalizeTrip(rawTrip);
  const nowMs = options.nowMs ?? Date.now();
  const now = new Date(nowMs);
  const todayKey = getBusinessDateKey(now, options.timeZone ?? BUSINESS_TZ);
  const tomorrowKey = addDaysToBusinessDateKey(todayKey, 1, options.timeZone ?? BUSINESS_TZ);
  const businessDateKey = getTripBusinessDateKey(trip, options.timeZone ?? BUSINESS_TZ);
  const status = trip.status as TripStatus;
  const isTerminal = isTripTerminal(trip);
  const isStale = !isTerminal && isTripStaleNonTerminal(trip, nowMs);
  const isActive = isTripActiveStatus(trip);
  const mins = minutesUntilPickup(trip.scheduledPickupTime, nowMs);
  const startMs = resolveTripStartMs(trip);

  let category: TripCategory;

  if (status === 'COMPLETED') category = 'completed';
  else if (status === 'CANCELLED') category = 'cancelled';
  else if (status === 'NO_SHOW') category = 'no_show';
  else if (isStale) category = 'stale';
  else if (trip.needsDispatch && status === 'SCHEDULED' && businessDateKey >= todayKey) category = 'needs_dispatch';
  else if (trip.needsDispatch && status === 'SCHEDULED' && businessDateKey < todayKey) category = 'stale';
  else if (isActive) category = 'active';
  else if (
    !isTerminal &&
    businessDateKey === todayKey &&
    UPCOMING_STATUSES.has(status) &&
    startMs != null &&
    startMs < nowMs
  ) category = 'missed_pickup';
  else if (businessDateKey === todayKey && !isTerminal && (isActive || (startMs != null && startMs >= nowMs))) {
    category = 'today';
  } else if (
    !isTerminal &&
    (businessDateKey > todayKey || (UPCOMING_STATUSES.has(status) && startMs != null && startMs >= nowMs))
  ) {
    category = 'upcoming';
  } else if (status === 'SCHEDULED') category = 'scheduled';
  else category = 'upcoming';

  const needsAdminReview = isStale || category === 'needs_dispatch' || category === 'missed_pickup'
    || trip.financialReviewStatus === 'PENDING';

  const shouldShowInToday = !isStale && !isTerminal && businessDateKey === todayKey;
  const shouldShowInUpcoming = !isStale && !isTerminal && businessDateKey >= todayKey
    && (category === 'upcoming' || category === 'today' || category === 'scheduled' || category === 'needs_dispatch');
  const shouldShowInLiveTracking = !isTerminal && (
    isTrackableStatus(status) ||
    UPCOMING_STATUSES.has(status) ||
    isStale
  );

  return {
    category,
    businessDateKey,
    displayLabel: categoryDisplayLabel(category),
    isStale,
    isTerminal,
    isActive,
    shouldShowInToday,
    shouldShowInUpcoming,
    shouldShowInLiveTracking,
    needsAdminReview,
    earningsEligibility: resolveEarningsEligibility(trip, status, isStale),
    trackingGroup: resolveTrackingGroup(trip, status, isStale, mins, nowMs, options.timeZone ?? BUSINESS_TZ),
    staleReason: isStale ? explainStaleTripReason(trip) : null,
    minutesUntilPickup: mins,
  };
}

export function filterTripsByCategory<T extends ClassifiableTrip>(
  trips: T[],
  predicate: (c: TripClassification) => boolean,
  options: { role: TripRole; nowMs?: number },
): T[] {
  return trips.filter((t) => predicate(classifyTripForRole(t, options)));
}

export function partitionTripsByReview<T extends ClassifiableTrip>(
  trips: T[],
  options: { role: TripRole; nowMs?: number },
): { normal: T[]; stale: T[] } {
  const normal: T[] = [];
  const stale: T[] = [];
  for (const trip of trips) {
    const c = classifyTripForRole(trip, options);
    if (c.isStale || c.category === 'stale' || c.category === 'missed_pickup') stale.push(trip);
    else normal.push(trip);
  }
  return { normal, stale };
}

export function groupTripsByTrackingGroup<T extends ClassifiableTrip>(
  trips: T[],
  options: { role: TripRole; nowMs?: number },
): Record<TrackingGroupKey, T[]> {
  const groups: Record<TrackingGroupKey, T[]> = {
    available_now: [],
    opens_soon: [],
    upcoming: [],
    needs_review: [],
  };
  for (const trip of trips) {
    const c = classifyTripForRole(trip, options);
    groups[c.trackingGroup].push(trip);
  }
  return groups;
}

export function computeTripCountsForRole<T extends ClassifiableTrip>(
  trips: T[],
  options: { role: TripRole; nowMs?: number },
): {
  todayTotal: number;
  active: number;
  completedToday: number;
  remainingToday: number;
  upcoming: number;
  stale: number;
  needsDispatch: number;
} {
  const nowMs = options.nowMs ?? Date.now();
  const todayKey = getBusinessDateKey(new Date(nowMs));
  let todayTotal = 0;
  let active = 0;
  let completedToday = 0;
  let remainingToday = 0;
  let upcoming = 0;
  let stale = 0;
  let needsDispatch = 0;

  for (const trip of trips) {
    const c = classifyTripForRole(trip, options);
    if (c.businessDateKey === todayKey && !c.isStale) todayTotal++;
    if (c.isActive && !c.isStale) active++;
    if (c.category === 'completed' && c.businessDateKey === todayKey) completedToday++;
    if (c.shouldShowInToday && !c.isTerminal && (c.isActive || (c.minutesUntilPickup != null && c.minutesUntilPickup >= 0))) {
      remainingToday++;
    }
    if ((c.category === 'upcoming' || c.category === 'today') && !c.isStale && !c.isTerminal) upcoming++;
    if (c.isStale) stale++;
    if (c.category === 'needs_dispatch') needsDispatch++;
  }

  return { todayTotal, active, completedToday, remainingToday, upcoming, stale, needsDispatch };
}

export function isNeedsDispatchOperational(
  trip: ClassifiableTrip,
  nowMs = Date.now(),
): boolean {
  const c = classifyTripForRole(trip, { role: 'ADMIN', nowMs });
  return c.category === 'needs_dispatch' && !c.isStale;
}

export function isTripPayrollEligible(trip: ClassifiableTrip, nowMs = Date.now()): boolean {
  const c = classifyTripForRole(trip, { role: 'ADMIN', nowMs });
  return c.earningsEligibility === 'payable';
}
