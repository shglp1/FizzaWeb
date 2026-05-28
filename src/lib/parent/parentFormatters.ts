import type { TripStatus } from '../trips/tripLifecycle.ts';
import { isTrackableStatus } from '../trips/tripLifecycle.ts';
import type { TripLegType } from '../tracking/trackingTypes.ts';
import { headlineForState, getParentTrackingCopy } from './parentTrackingCopy.ts';
import { resolveParentTrackingState } from './parentTrackingState.ts';

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

const ACTIVE_TRIP_STATUSES = new Set([
  'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
]);

function tripSortTime(trip: { scheduledPickupTime?: string | null; scheduledDate?: string | null }): number {
  if (trip.scheduledPickupTime) return new Date(trip.scheduledPickupTime).getTime();
  if (trip.scheduledDate) return new Date(`${trip.scheduledDate}T00:00:00`).getTime();
  return Number.MAX_SAFE_INTEGER;
}

/** Pick the trip parents care about most: in-progress first, then nearest upcoming. */
export function pickNextTrip<T extends { status: string; scheduledPickupTime?: string | null; scheduledDate?: string | null }>(
  trips: T[],
): T | null {
  if (!trips.length) return null;
  const active = trips.filter((t) => ACTIVE_TRIP_STATUSES.has(t.status));
  if (active.length) {
    return [...active].sort((a, b) => tripSortTime(a) - tripSortTime(b))[0] ?? null;
  }
  const upcoming = trips.filter((t) => ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status));
  if (!upcoming.length) return null;
  return [...upcoming].sort((a, b) => tripSortTime(a) - tripSortTime(b))[0] ?? null;
}

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
} | null | undefined): string {
  if (!vehicle) return 'Vehicle details pending';
  const parts = [vehicle.color, vehicle.model].filter(Boolean);
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
): TrackingAvailability {
  if (!hasDriver) return 'unassigned';
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return 'closed';
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
