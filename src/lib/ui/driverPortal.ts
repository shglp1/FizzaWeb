/**
 * Driver portal helpers — pure, testable (Task 13.4).
 */

import type { TripStatus } from '../trips/tripLifecycle.ts';
import { isActiveStatus, isTrackableStatus, TRIP_STATUS_LABEL } from '../trips/tripLifecycle.ts';

export type DriverTripTab =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'active'
  | 'completed'
  | 'cancelled';

export const DRIVER_ROUTE_SHEET_TABS: { label: string; value: DriverTripTab }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'week' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export const DRIVER_NAV_LABELS = {
  dashboard: 'Dashboard',
  routeSheet: 'Route Sheet',
  liveGps: 'Live GPS',
  safetyCenter: 'Safety Center',
  notifications: 'Notifications',
  profile: 'Profile',
} as const;

export const DRIVER_TRACKING_LIST_COPY = {
  driver: 'Share your live location for assigned trips so families can follow the ride safely.',
  parent: "Track your child's active trips",
} as const;

export type DriverPrimaryAction = {
  label: string;
  nextStatus?: TripStatus;
  disabled?: boolean;
  disabledReason?: string;
  kind: 'status' | 'navigate' | 'tracking' | 'view' | 'none';
};

const NEXT_STATUS: Partial<Record<TripStatus, TripStatus>> = {
  DRIVER_ASSIGNED: 'PRE_TRIP',
  PRE_TRIP: 'ON_THE_WAY',
  ON_THE_WAY: 'ARRIVED_PICKUP',
  ARRIVED_PICKUP: 'PICKED_UP',
  PICKED_UP: 'EN_ROUTE_DROPOFF',
  EN_ROUTE_DROPOFF: 'ARRIVED_DROPOFF',
  ARRIVED_DROPOFF: 'COMPLETED',
};

const ACTION_LABEL: Partial<Record<TripStatus, string>> = {
  SCHEDULED: 'Awaiting assignment',
  DRIVER_ASSIGNED: 'Start pre-trip',
  PRE_TRIP: 'Mark en route',
  ON_THE_WAY: 'Arrived at pickup',
  ARRIVED_PICKUP: 'Rider picked up',
  PICKED_UP: 'En route to drop-off',
  EN_ROUTE_DROPOFF: 'Arrived at drop-off',
  ARRIVED_DROPOFF: 'Complete trip',
  COMPLETED: 'View summary',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

export function getDriverPrimaryAction(status: TripStatus, withinTrackingWindow = true): DriverPrimaryAction {
  if (status === 'COMPLETED') {
    return { label: 'View summary', kind: 'view' };
  }
  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    return { label: ACTION_LABEL[status] ?? status, kind: 'none', disabled: true, disabledReason: 'Trip is read-only.' };
  }
  if (status === 'SCHEDULED') {
    return {
      label: 'Awaiting dispatch',
      kind: 'none',
      disabled: true,
      disabledReason: 'Admin has not assigned you yet.',
    };
  }
  if ((status === 'DRIVER_ASSIGNED' || status === 'PRE_TRIP') && !withinTrackingWindow) {
    return {
      label: 'Navigate to pickup',
      kind: 'navigate',
      disabled: true,
      disabledReason: 'GPS tracking opens about 10 minutes before pickup.',
    };
  }
  if (status === 'DRIVER_ASSIGNED' || status === 'PRE_TRIP') {
    return {
      label: status === 'DRIVER_ASSIGNED' ? 'Start pre-trip' : 'Mark en route',
      nextStatus: NEXT_STATUS[status],
      kind: 'status',
    };
  }
  const next = NEXT_STATUS[status];
  if (next) {
    return {
      label: ACTION_LABEL[status] ?? 'Update status',
      nextStatus: next,
      kind: 'status',
    };
  }
  return { label: 'Open tracking', kind: 'tracking' };
}

export function getDriverStatusActionLabel(status: TripStatus): string {
  return ACTION_LABEL[status] ?? TRIP_STATUS_LABEL[status] ?? status;
}

export type TrackingAvailability =
  | 'active_sharing'
  | 'available_now'
  | 'opens_soon'
  | 'closed'
  | 'not_assigned';

export function getTrackingAvailability(input: {
  status: string;
  scheduledPickupTime: string | null;
  hasLiveLocation?: boolean;
  nowMs?: number;
}): { availability: TrackingAvailability; label: string } {
  const now = input.nowMs ?? Date.now();
  const status = input.status as TripStatus;
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
    return { availability: 'closed', label: 'Closed' };
  }
  if (status === 'SCHEDULED') {
    return { availability: 'not_assigned', label: 'Not yet active' };
  }
  if (input.hasLiveLocation && isTrackableStatus(status)) {
    return { availability: 'active_sharing', label: 'Active sharing' };
  }
  const mins = input.scheduledPickupTime
    ? Math.round((new Date(input.scheduledPickupTime).getTime() - now) / 60_000)
    : null;
  if (mins != null && mins > 10 && !isActiveStatus(status)) {
    return { availability: 'opens_soon', label: `Opens in ~${mins} min` };
  }
  if (isTrackableStatus(status)) {
    return { availability: 'available_now', label: 'Available now' };
  }
  return { availability: 'opens_soon', label: 'Opens soon' };
}

export type SafetyStatusKey = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export const DRIVER_SAFETY_STATUS_LABEL: Record<SafetyStatusKey, string> = {
  PENDING: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESOLVED: 'Resolved',
};

export function groupNotificationsByDay<T extends { createdAt: string }>(
  items: T[],
  now = new Date(),
): { today: T[]; earlier: T[] } {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const today: T[] = [];
  const earlier: T[] = [];
  for (const item of items) {
    if (new Date(item.createdAt) >= todayStart) today.push(item);
    else earlier.push(item);
  }
  return { today, earlier };
}

export function mapNotificationCategory(type: string): 'Trip' | 'Dispatch' | 'Safety' | 'Payment' | 'System' {
  if (type === 'TRIP') return 'Trip';
  if (type === 'SAFETY') return 'Safety';
  if (type.includes('PAYMENT') || type === 'WALLET' || type === 'WALLET_TOP_UP') return 'Payment';
  if (type === 'DRIVER_APPLICATION') return 'Dispatch';
  return 'System';
}

export function hasRouteCoordinates(trip: {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
}): boolean {
  const pl = trip.pickupLat != null && Number.isFinite(Number(trip.pickupLat));
  const pg = trip.pickupLng != null && Number.isFinite(Number(trip.pickupLng));
  const dl = trip.dropoffLat != null && Number.isFinite(Number(trip.dropoffLat));
  const dg = trip.dropoffLng != null && Number.isFinite(Number(trip.dropoffLng));
  return (pl && pg) || (dl && dg);
}

export function hasRenderableMapPoints(input: {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
}): boolean {
  const coord = (v: unknown) => v != null && Number.isFinite(Number(v));
  return (
    (coord(input.pickupLat) && coord(input.pickupLng)) ||
    (coord(input.dropoffLat) && coord(input.dropoffLng)) ||
    (coord(input.driverLat) && coord(input.driverLng))
  );
}

export function minutesUntilPickup(scheduledPickupTime: string | null, nowMs = Date.now()): number | null {
  if (!scheduledPickupTime) return null;
  return Math.round((new Date(scheduledPickupTime).getTime() - nowMs) / 60_000);
}

export function isWithinTrackingWindow(scheduledPickupTime: string | null, nowMs = Date.now()): boolean {
  const mins = minutesUntilPickup(scheduledPickupTime, nowMs);
  if (mins == null) return true;
  return mins <= 10;
}

export function fmtDriverTime(t: string | null): string {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDriverDate(d: string): string {
  const dt = new Date(d.includes('T') ? d : `${d}T12:00:00`);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dt.toDateString() === today.toDateString()) return 'Today';
  if (dt.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
