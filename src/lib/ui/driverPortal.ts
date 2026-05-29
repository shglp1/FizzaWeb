/**
 * Driver portal helpers — pure, testable (Task 13.4 / 13.4.1).
 */

import type { TripStatus } from '../trips/tripLifecycle.ts';
import type { TripLegType } from '../tracking/trackingTypes.ts';
import { getDriverActionLabel } from './driverLifecycleConfirm.ts';
import { isActiveStatus, isTrackableStatus, TRIP_STATUS_LABEL } from '../trips/tripLifecycle.ts';
import {
  classifyTripForRole,
  groupTripsByTrackingGroup as groupByClassification,
} from '../trips/tripClassification.ts';
import {
  DRIVER_TIMEZONE as DRIVER_TZ,
  addDaysToDateKey as addDaysToDateKeyInTz,
  getTimezoneDateKey as getTzDateKey,
  getTripDateKey as getTripLocalDateKey,
  getWeekDateRangeInTimezone,
} from './driverTripSelection.ts';
import { formatTripDateTimeInBusinessTz } from '../time/businessTimezone.ts';

export {
  DRIVER_ACTIVE_STATUSES,
  DRIVER_TERMINAL_STATUSES,
  DRIVER_TIMEZONE,
  DRIVER_UPCOMING_STATUSES,
  computeDriverTripCounts,
  explainNextTripExclusion,
  explainStaleTripReason,
  filterDriverAssignedTrips,
  filterTripsForLocalDate,
  addDaysToDateKey,
  getTimezoneDateKey,
  getTripDateKey,
  getWeekDateRangeInTimezone,
  isDriverActiveTrip,
  isDriverNextTripCandidate,
  isTripAssignedToDriver,
  isTripStaleNonTerminal,
  partitionStaleTrips,
  pickNextDriverTrip,
  resolveDriverHeroTrip,
  resolveTripStartMs,
  sortTripsByStartAsc,
} from './driverTripSelection.ts';

export {
  BUSINESS_TZ,
  BUSINESS_TZ as BUSINESS_TIMEZONE,
  formatTripDateTimeInBusinessTz,
  getBusinessDateKey,
  getBusinessDayRange,
  getTripBusinessDateKey,
  isSameBusinessDay,
  parseBusinessLocalTime,
} from '../time/businessTimezone.ts';

export {
  classifyTripForRole,
  computeTripCountsForRole,
  groupTripsByTrackingGroup,
  isNeedsDispatchOperational,
  isTripPayrollEligible,
  partitionTripsByReview,
} from '../trips/tripClassification.ts';

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
  routeSheetMobile: 'Route',
  liveGps: 'Live GPS',
  safetyCenter: 'Safety Center',
  notifications: 'Notifications',
  profile: 'Profile',
} as const;

export const DRIVER_TRACKING_LIST_COPY = {
  driver: 'Share your live location for assigned trips so families can follow the ride safely.',
  parent: "Track your child's active trips",
} as const;

export const MAP_FALLBACK_LABEL =
  'Map unavailable because this trip does not have confirmed coordinates.';

export const TRACKING_GROUP_LABELS = {
  available_now: 'Available now',
  opens_soon: 'Opens soon',
  upcoming: 'Upcoming',
  needs_review: 'Needs review',
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
  DRIVER_ASSIGNED: 'Start trip',
  PRE_TRIP: 'Heading to pickup',
  ON_THE_WAY: 'Arrived at pickup',
  ARRIVED_PICKUP: 'Student picked up',
  PICKED_UP: 'En route to drop-off',
  EN_ROUTE_DROPOFF: 'Arrived at drop-off',
  ARRIVED_DROPOFF: 'Complete trip — student delivered',
  COMPLETED: 'View summary',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

function actionLabel(status: TripStatus, legType?: TripLegType | null): string {
  return getDriverActionLabel(status, legType) || ACTION_LABEL[status] || status;
}

export function getDriverPrimaryAction(
  status: TripStatus,
  withinTrackingWindow = true,
  options?: { isAssignedToCurrentDriver?: boolean; legType?: TripLegType | null },
): DriverPrimaryAction {
  const legType = options?.legType;
  const isAssigned = options?.isAssignedToCurrentDriver ?? false;
  if (status === 'COMPLETED') {
    return { label: 'View summary', kind: 'view' };
  }
  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    return { label: ACTION_LABEL[status] ?? status, kind: 'none', disabled: true, disabledReason: 'Trip is read-only.' };
  }
  if (status === 'SCHEDULED') {
    if (isAssigned) {
      if (!withinTrackingWindow) {
        return {
          label: 'Navigate to pickup',
          kind: 'navigate',
          disabled: true,
          disabledReason: 'GPS opens 10 minutes before pickup.',
        };
      }
      return {
        label: 'Start trip',
        nextStatus: 'PRE_TRIP',
        kind: 'status',
      };
    }
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
      disabledReason: 'GPS opens 10 minutes before pickup.',
    };
  }
  if (status === 'DRIVER_ASSIGNED' || status === 'PRE_TRIP') {
    return {
      label: status === 'DRIVER_ASSIGNED' ? 'Start trip' : actionLabel(status, legType),
      nextStatus: NEXT_STATUS[status],
      kind: 'status',
    };
  }
  const next = NEXT_STATUS[status];
  if (next) {
    return {
      label: actionLabel(status, legType),
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
  | 'not_assigned'
  | 'needs_review';

export type TrackingGroupKey = 'available_now' | 'opens_soon' | 'upcoming' | 'needs_review';

export function getTrackingAvailability(input: {
  status: string;
  scheduledDate?: string;
  scheduledPickupTime: string | null;
  hasLiveLocation?: boolean;
  nowMs?: number;
}): { availability: TrackingAvailability; label: string; group: TrackingGroupKey } {
  const nowMs = input.nowMs ?? Date.now();
  const status = input.status as TripStatus;
  const trip = {
    status: input.status,
    scheduledDate: input.scheduledDate
      ?? (input.scheduledPickupTime ? input.scheduledPickupTime.slice(0, 10) : ''),
    scheduledPickupTime: input.scheduledPickupTime,
  };
  const c = classifyTripForRole(trip, { role: 'DRIVER', nowMs });

  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
    return { availability: 'closed', label: 'Closed', group: 'upcoming' };
  }
  if (status === 'SCHEDULED') {
    return { availability: 'not_assigned', label: 'Not yet active', group: 'upcoming' };
  }
  if (c.isStale || c.trackingGroup === 'needs_review') {
    return { availability: 'needs_review', label: c.staleReason ?? 'Needs review', group: 'needs_review' };
  }
  if (input.hasLiveLocation && isTrackableStatus(status)) {
    return { availability: 'active_sharing', label: 'Active sharing', group: 'available_now' };
  }
  if (c.trackingGroup === 'available_now') {
    return { availability: 'available_now', label: 'Available now', group: 'available_now' };
  }
  if (c.trackingGroup === 'opens_soon') {
    const mins = c.minutesUntilPickup;
    return {
      availability: 'opens_soon',
      label: mins != null ? `Opens in ~${mins} min` : 'Opens soon',
      group: 'opens_soon',
    };
  }
  return { availability: 'upcoming' as TrackingAvailability, label: 'Upcoming', group: c.trackingGroup };
}

export function groupTripsByTrackingAvailability<
  T extends { status: string; scheduledDate: string; scheduledPickupTime: string | null },
>(trips: T[], nowMs = Date.now()): Record<TrackingGroupKey, T[]> {
  return groupByClassification(trips, { role: 'DRIVER', nowMs }) as Record<TrackingGroupKey, T[]>;
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

export function truncateRouteLabel(text: string, max = 42): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
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

export function formatCountdown(mins: number | null): string | null {
  if (mins == null) return null;
  if (mins <= 0) return 'Now';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function isWithinTrackingWindow(scheduledPickupTime: string | null, nowMs = Date.now()): boolean {
  const mins = minutesUntilPickup(scheduledPickupTime, nowMs);
  if (mins == null) return true;
  return mins <= 10;
}

export function fmtDriverTime(t: string | null, timeZone = DRIVER_TZ): string {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('en-SA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDriverDate(d: string, now = new Date(), timeZone = DRIVER_TZ): string {
  const tripKey = getTripLocalDateKey({ scheduledDate: d }, timeZone);
  const todayKey = getTzDateKey(now, timeZone);
  const tomorrowKey = addDaysToDateKeyInTz(todayKey, 1, timeZone);
  if (tripKey === todayKey) return 'Today';
  if (tripKey === tomorrowKey) return 'Tomorrow';
  const dt = d.includes('T') ? new Date(d) : new Date(`${d.split('T')[0]}T12:00:00.000Z`);
  return dt.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtDriverDateTimeLabel(
  trip: { scheduledDate: string; scheduledPickupTime?: string | null },
  now = new Date(),
  timeZone = DRIVER_TZ,
): string {
  return formatTripDateTimeInBusinessTz(trip, now, timeZone);
}

/** Returns true when page should render driver-specific UI (not parent). */
export function isDriverRole(role: string | null | undefined): boolean {
  return role === 'DRIVER';
}

// ─── Task 13.4.2 production helpers ───────────────────────────────────────────

export const CHAT_WINDOW_MINUTES_BEFORE = 20;
export const CHAT_UNAVAILABLE_BEFORE_LABEL = 'Chat opens 20 minutes before pickup.';
export const CHAT_BLOCKED_LABEL = 'Your chat access is restricted due to FIZZA safety rules.';
export const ROUTE_GEOMETRY_FALLBACK_LABEL = 'Road route unavailable; showing approximate route.';

export function getWeekDateRange(now = new Date()): { from: string; to: string } {
  return getWeekDateRangeInTimezone(now, DRIVER_TZ);
}

export function buildDriverTripsListParams(
  tab: DriverTripTab,
  page: number,
  limit = 50,
  now = new Date(),
): { status?: string; from?: string; to?: string; page: number; limit: number } {
  const today = getTzDateKey(now, DRIVER_TZ);
  const tomorrow = addDaysToDateKeyInTz(today, 1, DRIVER_TZ);
  const week = getWeekDateRange(now);

  switch (tab) {
    case 'today':
      return { from: today, to: today, page, limit };
    case 'tomorrow':
      return { from: tomorrow, to: tomorrow, page, limit };
    case 'week':
      return { from: week.from, to: week.to, page, limit };
    case 'active':
      return { status: 'active', page, limit };
    case 'completed':
      return { status: 'completed', page, limit };
    case 'cancelled':
      return { status: 'cancelled', page, limit };
    default:
      return { page, limit };
  }
}

export function getChatUnavailableReason(input: {
  windowOpen: boolean;
  scheduledPickupTime: string | null;
  chatClosedAt: string | null;
  status: string;
}): string | null {
  if (input.chatClosedAt) return 'Chat is closed for this trip.';
  if (input.windowOpen) return null;
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(input.status)) {
    return 'Chat window has closed for this trip.';
  }
  const mins = minutesUntilPickup(input.scheduledPickupTime);
  if (mins != null && mins > CHAT_WINDOW_MINUTES_BEFORE) {
    return CHAT_UNAVAILABLE_BEFORE_LABEL;
  }
  return CHAT_UNAVAILABLE_BEFORE_LABEL;
}

export type MoreMenuAction = {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
};

export function getDriverMoreMenuActions(
  trip: {
    id: string;
    status: string;
    scheduledPickupTime: string | null;
    pickupLocation: string;
    dropoffLocation: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
  },
  options?: { supportPhone?: string | null },
): MoreMenuAction[] {
  const status = trip.status as TripStatus;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.pickupLocation)}&destination=${encodeURIComponent(trip.dropoffLocation)}`;
  const canNoShow = status === 'ARRIVED_PICKUP';
  const canReportLate = ['ON_THE_WAY', 'ARRIVED_PICKUP', 'PRE_TRIP', 'DRIVER_ASSIGNED'].includes(status);
  const terminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status);

  const actions: MoreMenuAction[] = [
    { id: 'details', label: 'View trip details', href: `/tracking/${trip.id}` },
    {
      id: 'tracking',
      label: 'Open tracking',
      href: `/tracking/${trip.id}`,
      disabled: terminal,
      disabledReason: terminal ? 'Trip is no longer active.' : undefined,
    },
    { id: 'maps', label: 'Open route in Google Maps', href: mapsUrl },
    { id: 'safety', label: 'Report safety issue', href: `/safety?tripId=${trip.id}` },
  ];

  if (canReportLate) {
    actions.push({
      id: 'late',
      label: 'Report rider late',
      disabled: !['ON_THE_WAY', 'ARRIVED_PICKUP'].includes(status),
      disabledReason: status === 'PRE_TRIP' || status === 'DRIVER_ASSIGNED'
        ? 'Available once you are en route to pickup.'
        : undefined,
    });
  }

  if (canNoShow) {
    actions.push({
      id: 'no_show',
      label: 'Mark no-show',
      destructive: true,
    });
  }

  if (options?.supportPhone) {
    actions.push({
      id: 'support',
      label: 'Contact support',
      href: `tel:${options.supportPhone}`,
    });
  }

  actions.push({
    id: 'copy_pickup',
    label: 'Copy pickup address',
  });
  actions.push({
    id: 'copy_dropoff',
    label: 'Copy dropoff address',
  });

  return actions;
}

const ACTIVITY_LABELS: Record<string, string> = {
  DRIVER_ASSIGNED: 'Driver assigned',
  LOCATION_SHARING: 'GPS sharing started',
  NEAR_PICKUP: 'Near pickup',
  ARRIVED_PICKUP: 'Arrived at pickup',
  RIDER_PICKED_UP: 'Rider picked up',
  NEAR_DROPOFF: 'Near drop-off',
  ARRIVED_DROPOFF: 'Arrived at drop-off',
  TRIP_COMPLETED: 'Trip completed',
  DRIVER_LATE: 'Driver reported late',
  RIDER_LATE: 'Rider reported late',
  TRIP_CANCELLED: 'Trip cancelled',
  NO_SHOW: 'No-show recorded',
  STATUS_CHANGE: 'Status updated',
  STATUS_CHANGED: 'Status updated',
  CONTINUED_WITHOUT_GPS: 'Continued without GPS',
  MODERATION_FLAGGED: 'Chat message flagged',
  CHAT_MESSAGE_FLAGGED: 'Chat message flagged',
};

export function formatTripActivityLabel(eventType: string, message: string | null): string {
  if (message?.trim()) return message.trim();
  return ACTIVITY_LABELS[eventType] ?? eventType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export type GpsPermissionUiState =
  | 'unsupported'
  | 'unknown'
  | 'prompt_needed'
  | 'granted'
  | 'denied'
  | 'denied_permanent'
  | 'active'
  | 'stale'
  | 'stopped'
  | 'error'
  | 'outside_window';

export const GPS_PERMISSION_EXPLAIN =
  'FIZZA uses your live location only during assigned trips so families can track the ride safely.';

export const GPS_DENIED_INSTRUCTIONS =
  'Open browser site settings → Location → Allow for this site, then tap Retry.';

export const GPS_OUTSIDE_WINDOW_LABEL = 'GPS sharing opens 10 minutes before pickup.';

export function getGpsPermissionLabel(state: GpsPermissionUiState): string {
  switch (state) {
    case 'unsupported': return 'GPS not supported in this browser';
    case 'unknown': return 'Location permission not checked yet';
    case 'prompt_needed': return 'Enable GPS sharing';
    case 'granted': return 'Location permission granted';
    case 'denied': return 'Location permission denied';
    case 'denied_permanent': return 'Location blocked in browser settings';
    case 'active': return 'GPS sharing active';
    case 'stale': return 'GPS signal delayed';
    case 'stopped': return 'GPS sharing stopped';
    case 'error': return 'GPS sharing error';
    case 'outside_window': return 'GPS not available yet';
    default: return 'GPS status';
  }
}

