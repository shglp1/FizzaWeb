import type { TripStatus } from '../trips/tripLifecycle.ts';
import { isTrackableStatus } from '../trips/tripLifecycle.ts';
import type { TripLegType } from '../tracking/trackingTypes.ts';
import { headlineForState, getParentTrackingCopy } from './parentTrackingCopy.ts';
import { resolveParentTrackingState } from './parentTrackingState.ts';
import {
  classifyTripForRole,
  computeTripCountsForRole,
  groupTripsByTrackingGroup,
  resolveTripStartMs,
} from '../trips/tripClassification.ts';
import { explainStaleTripReason } from '../time/businessTimezone.ts';

export function formatSarParent(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `SAR ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

const RIYADH_TZ = 'Asia/Riyadh';

export function formatTripDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-SA', {
    timeZone: RIYADH_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveScheduledDate(trip: { scheduledDate?: string | null; scheduledPickupTime?: string | null }): string | null {
  if (trip.scheduledDate) return trip.scheduledDate.split('T')[0]!;
  if (trip.scheduledPickupTime) return trip.scheduledPickupTime.slice(0, 10);
  return null;
}

/** Pick the trip parents care about most: non-stale active first, then today, then upcoming. */
export function pickNextTrip<T extends { status: string; scheduledPickupTime?: string | null; scheduledDate?: string | null }>(
  trips: T[],
  nowMs = Date.now(),
): T | null {
  const eligible = trips.flatMap((t) => {
    const scheduledDate = resolveScheduledDate(t);
    if (!scheduledDate) return [];
    const c = classifyTripForRole(
      { status: t.status, scheduledDate, scheduledPickupTime: t.scheduledPickupTime },
      { role: 'PARENT', nowMs },
    );
    if (c.isStale || c.category === 'stale' || c.category === 'missed_pickup') return [];
    return [{ trip: t, scheduledDate }];
  });
  if (!eligible.length) return null;

  const active = eligible.filter(({ trip, scheduledDate }) => classifyTripForRole(
    { status: trip.status, scheduledDate, scheduledPickupTime: trip.scheduledPickupTime },
    { role: 'PARENT', nowMs },
  ).isActive);
  if (active.length) {
    return [...active].sort((a, b) => (resolveTripStartMs({ ...a.trip, scheduledDate: a.scheduledDate }) ?? 0) - (resolveTripStartMs({ ...b.trip, scheduledDate: b.scheduledDate }) ?? 0))[0]!.trip;
  }

  const todayOrUpcoming = eligible.filter(({ trip, scheduledDate }) => {
    const c = classifyTripForRole(
      { status: trip.status, scheduledDate, scheduledPickupTime: trip.scheduledPickupTime },
      { role: 'PARENT', nowMs },
    );
    return c.category === 'today' || c.category === 'upcoming' || c.category === 'scheduled';
  });
  if (!todayOrUpcoming.length) return null;
  return [...todayOrUpcoming].sort((a, b) => (resolveTripStartMs({ ...a.trip, scheduledDate: a.scheduledDate }) ?? 0) - (resolveTripStartMs({ ...b.trip, scheduledDate: b.scheduledDate }) ?? 0))[0]!.trip;
}

export function computeParentTripCounts<T extends { status: string; scheduledDate: string; scheduledPickupTime?: string | null }>(
  trips: T[],
  nowMs = Date.now(),
) {
  return computeTripCountsForRole(trips, { role: 'PARENT', nowMs });
}

export function explainParentStaleTrip(trip: { status: string; scheduledDate: string; scheduledPickupTime?: string | null }): string {
  return explainStaleTripReason(trip);
}

export function groupParentTripsByTracking<T extends { status: string; scheduledDate: string; scheduledPickupTime?: string | null }>(
  trips: T[],
  nowMs = Date.now(),
) {
  return groupTripsByTrackingGroup(trips, { role: 'PARENT', nowMs });
}

export const PARENT_TRACKING_GROUP_LABELS: Record<string, string> = {
  available_now: 'Live now',
  opens_soon: 'Opens soon',
  upcoming: 'Upcoming',
  needs_review: 'Needs review',
};

export function formatDriverSummary(driver: {
  profile?: { fullName?: string | null; avatarUrl?: string | null } | null;
  rating?: number | string | null;
} | null | undefined): { name: string; rating: string; avatarUrl: string | null } {
  const name = driver?.profile?.fullName ?? 'Driver';
  const rating = driver?.rating != null ? Number(driver.rating).toFixed(1) : '—';
  return { name, rating, avatarUrl: driver?.profile?.avatarUrl ?? null };
}

export function formatVehicleSummary(vehicle: {
  model?: string | null;
  color?: string | null;
  plateNumber?: string | null;
  capacity?: number | null;
  make?: string | null;
  year?: number | null;
} | null | undefined): string {
  if (!vehicle) return 'Vehicle details pending';
  const label = vehicle.make && vehicle.model
    ? [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')
    : vehicle.model;
  const parts = [vehicle.color, label].filter(Boolean);
  if (vehicle.plateNumber) parts.push(vehicle.plateNumber);
  if (vehicle.capacity) parts.push(`${vehicle.capacity} seats`);
  return parts.join(' · ') || 'Vehicle assigned';
}

export type TrackingAvailability = 'available' | 'opens_soon' | 'not_yet' | 'unassigned' | 'closed';

export function getTrackingAvailability(
  status: TripStatus | string,
  scheduledPickupTime: string | null,
  hasDriver: boolean,
  chatOpenMinutes = 20,
  scheduledDate?: string,
): TrackingAvailability {
  if (!hasDriver) return 'unassigned';
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return 'closed';

  const trip = {
    status,
    scheduledDate: scheduledDate ?? (scheduledPickupTime ? scheduledPickupTime.slice(0, 10) : ''),
    scheduledPickupTime,
  };
  const c = classifyTripForRole(trip, { role: 'PARENT' });
  if (c.isStale) return 'not_yet';

  if (isTrackableStatus(status as TripStatus)) return 'available';
  if (scheduledPickupTime) {
    const mins = (new Date(scheduledPickupTime).getTime() - Date.now()) / 60000;
    if (mins <= chatOpenMinutes) return 'opens_soon';
  }
  return 'not_yet';
}

export function trackingAvailabilityLabel(a: TrackingAvailability): string {
  const c = getParentTrackingCopy('en');
  switch (a) {
    case 'available': return c.gpsActive;
    case 'opens_soon': return c.gpsOpensSoon;
    case 'not_yet': return c.waitingForWindow;
    case 'unassigned': return c.driverNotAssigned;
    case 'closed': return c.tripCompleted;
    default: return '';
  }
}

/** Parent-friendly headline for dashboard hero badge (no live location required). */
export function parentTrackingHeadline(trip: {
  status: string;
  legType?: TripLegType | null;
  scheduledPickupTime?: string | null;
  driver?: unknown;
  actualPickupTime?: string | null;
  actualDropoffTime?: string | null;
}): string {
  const state = resolveParentTrackingState({
    status: trip.status,
    legType: trip.legType,
    hasDriver: Boolean(trip.driver),
    location: null,
    scheduledPickupTime: trip.scheduledPickupTime ?? null,
    actualPickupTime: trip.actualPickupTime ?? null,
    actualDropoffTime: trip.actualDropoffTime ?? null,
  });
  return headlineForState(state.id, 'en', state.etaMinutes);
}

export function formatSubscriptionRoute(pickup: string, dropoff: string): string {
  const p = pickup.length > 40 ? `${pickup.slice(0, 40)}…` : pickup;
  const d = dropoff.length > 40 ? `${dropoff.slice(0, 40)}…` : dropoff;
  return `${p} → ${d}`;
}

export function formatServiceDays(schedules: { weekday: number; isOffDay: boolean }[]): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const active = schedules.filter((s) => !s.isOffDay).map((s) => labels[s.weekday]).filter(Boolean);
  return active.length ? active.join(', ') : '—';
}

export function groupTransactionsByDate<T extends { createdAt: string }>(
  items: T[],
): { date: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const date = new Date(item.createdAt).toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(item);
  }
  return [...map.entries()].map(([date, grouped]) => ({ date, items: grouped }));
}
