/**
 * Trip lifecycle — valid status transitions (Task 12B).
 *
 * SCHEDULED → DRIVER_ASSIGNED → PRE_TRIP → ON_THE_WAY → ARRIVED_PICKUP
 *   → PICKED_UP → EN_ROUTE_DROPOFF → ARRIVED_DROPOFF → COMPLETED
 *
 * Terminals: COMPLETED, CANCELLED, NO_SHOW
 */

export type TripStatus =
  | 'SCHEDULED'
  | 'DRIVER_ASSIGNED'
  | 'PRE_TRIP'
  | 'ON_THE_WAY'
  | 'ARRIVED_PICKUP'
  | 'PICKED_UP'
  | 'EN_ROUTE_DROPOFF'
  | 'ARRIVED_DROPOFF'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

/** All valid forward transitions (driver-initiated). */
export const DRIVER_TRANSITIONS: Partial<Record<TripStatus, TripStatus[]>> = {
  DRIVER_ASSIGNED:  ['PRE_TRIP', 'ON_THE_WAY'],
  PRE_TRIP:         ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY:       ['ARRIVED_PICKUP', 'CANCELLED'],
  ARRIVED_PICKUP:   ['PICKED_UP', 'NO_SHOW'],
  PICKED_UP:        ['EN_ROUTE_DROPOFF'],
  EN_ROUTE_DROPOFF: ['ARRIVED_DROPOFF'],
  ARRIVED_DROPOFF:  ['COMPLETED'],
};

/** Admin can force-set additional transitions that drivers cannot. */
export const ADMIN_EXTRA_TRANSITIONS: Partial<Record<TripStatus, TripStatus[]>> = {
  SCHEDULED:        ['DRIVER_ASSIGNED', 'CANCELLED'],
  DRIVER_ASSIGNED:  ['PRE_TRIP', 'ON_THE_WAY', 'CANCELLED', 'SCHEDULED'],
  PRE_TRIP:         ['ON_THE_WAY', 'DRIVER_ASSIGNED', 'CANCELLED'],
  ON_THE_WAY:       ['ARRIVED_PICKUP', 'PRE_TRIP', 'CANCELLED'],
  ARRIVED_PICKUP:   ['PICKED_UP', 'NO_SHOW', 'ON_THE_WAY', 'CANCELLED'],
  PICKED_UP:        ['EN_ROUTE_DROPOFF', 'ARRIVED_PICKUP', 'CANCELLED'],
  EN_ROUTE_DROPOFF: ['ARRIVED_DROPOFF', 'PICKED_UP', 'CANCELLED'],
  ARRIVED_DROPOFF:  ['COMPLETED', 'EN_ROUTE_DROPOFF', 'CANCELLED'],
  COMPLETED:        ['CANCELLED'],   // admin-only revert
  NO_SHOW:          ['CANCELLED'],
};

/**
 * Returns true if the transition from `from` → `to` is valid for the given role.
 */
export function isValidTransition(
  from: TripStatus,
  to: TripStatus,
  role: 'DRIVER' | 'ADMIN' | 'PARENT',
): boolean {
  if (from === to) return false;
  if (role === 'ADMIN') {
    const allowed = ADMIN_EXTRA_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }
  if (role === 'PARENT') {
    // Parents can only cancel when trip is in a cancellable state
    return to === 'CANCELLED' && ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP'].includes(from);
  }
  // DRIVER
  const allowed = DRIVER_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/** Human-readable label for display — delegates to status catalog. */
export { getDisplayLabel as getTripDisplayLabel } from './statusCatalog.ts';

/** @deprecated Use getDisplayLabel from statusCatalog for UI. Kept for backward compat. */
export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  SCHEDULED:        'Scheduled',
  DRIVER_ASSIGNED:  'Driver Assigned',
  PRE_TRIP:         'Pre-Trip Tracking',
  ON_THE_WAY:       'En Route to Pickup',
  ARRIVED_PICKUP:   'Arrived at Pickup',
  PICKED_UP:        'Rider Picked Up',
  EN_ROUTE_DROPOFF: 'En Route to Drop-off',
  ARRIVED_DROPOFF:  'Arrived at Drop-off',
  COMPLETED:        'Completed',
  CANCELLED:        'Cancelled',
  NO_SHOW:          'No Show',
};

/** Whether a status means the trip is "active" (driver is working on it). */
export function isActiveStatus(status: TripStatus): boolean {
  return ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(status);
}

/** Whether a status is "trackable" (parent can see live location). */
export function isTrackableStatus(status: TripStatus): boolean {
  return ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(status);
}

/** Whether a trip can be cancelled. */
export function isCancellable(status: TripStatus): boolean {
  return ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY'].includes(status);
}

const TERMINAL_STATUSES: TripStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

/** Whether the chat window should be open based on scheduled pickup time. */
export type ChatWindowTiming = {
  openMinutesBeforePickup?: number;
  closeMinutesAfterDropoff?: number;
};

const DEFAULT_CHAT_TIMING: Required<ChatWindowTiming> = {
  openMinutesBeforePickup: 20,
  closeMinutesAfterDropoff: 60,
};

export function isChatWindowOpen(
  scheduledPickupTime: Date | null,
  tripStatus: TripStatus,
  chatOpenedAt: Date | null,
  chatClosedAt: Date | null,
  nowMs: number = Date.now(),
  /** When the trip reached a terminal status (completion/cancel/no-show). */
  tripEndedAt: Date | null = null,
  timing: ChatWindowTiming = DEFAULT_CHAT_TIMING,
): boolean {
  const openBefore = timing.openMinutesBeforePickup ?? DEFAULT_CHAT_TIMING.openMinutesBeforePickup;
  const closeAfter = timing.closeMinutesAfterDropoff ?? DEFAULT_CHAT_TIMING.closeMinutesAfterDropoff;

  // Admin hard-close
  if (chatClosedAt) return false;

  // Terminal trips: chat stays open for configured minutes after end
  if (TERMINAL_STATUSES.includes(tripStatus)) {
    if (!tripEndedAt) return false;
    return nowMs <= tripEndedAt.getTime() + closeAfter * 60 * 1000;
  }

  if (chatOpenedAt) return true;

  if (!scheduledPickupTime) return false;
  const pickupMs = scheduledPickupTime.getTime();
  const windowOpenMs = pickupMs - openBefore * 60 * 1000;
  return nowMs >= windowOpenMs;
}

/** Whether a driver may push GPS for this trip right now. */
export function isLocationSharingAllowed(
  tripStatus: TripStatus,
  scheduledPickupTime: Date | null,
  nowMs: number = Date.now(),
): boolean {
  if (TERMINAL_STATUSES.includes(tripStatus) || tripStatus === 'SCHEDULED') return false;

  if (
    tripStatus === 'PICKED_UP' ||
    tripStatus === 'EN_ROUTE_DROPOFF' ||
    tripStatus === 'ARRIVED_DROPOFF' ||
    tripStatus === 'ARRIVED_PICKUP'
  ) {
    return true;
  }

  if (tripStatus === 'PRE_TRIP' || tripStatus === 'ON_THE_WAY' || tripStatus === 'DRIVER_ASSIGNED') {
    return isPreTripWindowOpen(scheduledPickupTime, nowMs) || tripStatus === 'ON_THE_WAY';
  }

  return false;
}

/** Whether a parent may view live GPS (10 min before pickup or active leg). */
export function isParentLocationVisible(
  tripStatus: TripStatus,
  scheduledPickupTime: Date | null,
  nowMs: number = Date.now(),
): boolean {
  if (TERMINAL_STATUSES.includes(tripStatus)) return false;
  if (isActiveStatus(tripStatus)) return true;
  if (tripStatus === 'DRIVER_ASSIGNED') {
    return isPreTripWindowOpen(scheduledPickupTime, nowMs);
  }
  return false;
}

/** Whether the pre-trip tracking window is open (10 min before pickup). */
export function isPreTripWindowOpen(
  scheduledPickupTime: Date | null,
  nowMs: number = Date.now(),
): boolean {
  if (!scheduledPickupTime) return false;
  const pickupMs = scheduledPickupTime.getTime();
  const windowOpenMs = pickupMs - 10 * 60 * 1000;
  return nowMs >= windowOpenMs;
}

/**
 * Haversine distance in metres between two lat/lng pairs.
 * Used for geofence proximity checks.
 */
export function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000; // earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
