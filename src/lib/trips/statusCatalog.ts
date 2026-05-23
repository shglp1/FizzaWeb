/**
 * Production status catalog — maps internal TripStatus to business-facing labels.
 * Internal enum values are kept for DB stability; UI/API use this catalog.
 */

import type { TripStatus } from './tripLifecycle.ts';
import { DRIVER_TRANSITIONS, ADMIN_EXTRA_TRANSITIONS } from './tripLifecycle.ts';

/** Business-facing lifecycle labels (spec-aligned). */
export type DisplayStatus =
  | 'SCHEDULED'
  | 'DRIVER_ASSIGNED'
  | 'PRE_TRIP_TRACKING'
  | 'EN_ROUTE_TO_PICKUP'
  | 'ARRIVING_PICKUP'
  | 'ARRIVED_PICKUP'
  | 'RIDER_PICKED_UP'
  | 'EN_ROUTE_TO_DROPOFF'
  | 'ARRIVING_DROPOFF'
  | 'ARRIVED_DROPOFF'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'DRIVER_LATE'
  | 'RIDER_LATE';

export type OperationalPhase =
  | 'PLANNED'
  | 'ASSIGNED'
  | 'PRE_TRIP'
  | 'PICKUP_LEG'
  | 'DROPOFF_LEG'
  | 'COMPLETE'
  | 'EXCEPTION';

export type StatusCatalogEntry = {
  internalStatus: TripStatus;
  displayStatus: DisplayStatus;
  displayLabel: string;
  timelineLabel: string;
  operationalPhase: OperationalPhase;
  sortOrder: number;
};

const CATALOG: Record<TripStatus, StatusCatalogEntry> = {
  SCHEDULED: {
    internalStatus: 'SCHEDULED',
    displayStatus: 'SCHEDULED',
    displayLabel: 'Scheduled',
    timelineLabel: 'Trip scheduled',
    operationalPhase: 'PLANNED',
    sortOrder: 10,
  },
  DRIVER_ASSIGNED: {
    internalStatus: 'DRIVER_ASSIGNED',
    displayStatus: 'DRIVER_ASSIGNED',
    displayLabel: 'Driver Assigned',
    timelineLabel: 'Driver assigned',
    operationalPhase: 'ASSIGNED',
    sortOrder: 20,
  },
  PRE_TRIP: {
    internalStatus: 'PRE_TRIP',
    displayStatus: 'PRE_TRIP_TRACKING',
    displayLabel: 'Pre-Trip Tracking',
    timelineLabel: 'Driver started pre-trip tracking',
    operationalPhase: 'PRE_TRIP',
    sortOrder: 30,
  },
  ON_THE_WAY: {
    internalStatus: 'ON_THE_WAY',
    displayStatus: 'EN_ROUTE_TO_PICKUP',
    displayLabel: 'En Route to Pickup',
    timelineLabel: 'Driver en route to pickup',
    operationalPhase: 'PICKUP_LEG',
    sortOrder: 40,
  },
  ARRIVED_PICKUP: {
    internalStatus: 'ARRIVED_PICKUP',
    displayStatus: 'ARRIVED_PICKUP',
    displayLabel: 'Arrived at Pickup',
    timelineLabel: 'Driver arrived at pickup',
    operationalPhase: 'PICKUP_LEG',
    sortOrder: 50,
  },
  PICKED_UP: {
    internalStatus: 'PICKED_UP',
    displayStatus: 'RIDER_PICKED_UP',
    displayLabel: 'Rider Picked Up',
    timelineLabel: 'Rider picked up',
    operationalPhase: 'DROPOFF_LEG',
    sortOrder: 60,
  },
  EN_ROUTE_DROPOFF: {
    internalStatus: 'EN_ROUTE_DROPOFF',
    displayStatus: 'EN_ROUTE_TO_DROPOFF',
    displayLabel: 'En Route to Drop-off',
    timelineLabel: 'En route to drop-off',
    operationalPhase: 'DROPOFF_LEG',
    sortOrder: 70,
  },
  ARRIVED_DROPOFF: {
    internalStatus: 'ARRIVED_DROPOFF',
    displayStatus: 'ARRIVED_DROPOFF',
    displayLabel: 'Arrived at Drop-off',
    timelineLabel: 'Arrived at drop-off',
    operationalPhase: 'DROPOFF_LEG',
    sortOrder: 80,
  },
  COMPLETED: {
    internalStatus: 'COMPLETED',
    displayStatus: 'COMPLETED',
    displayLabel: 'Completed',
    timelineLabel: 'Trip completed',
    operationalPhase: 'COMPLETE',
    sortOrder: 90,
  },
  CANCELLED: {
    internalStatus: 'CANCELLED',
    displayStatus: 'CANCELLED',
    displayLabel: 'Cancelled',
    timelineLabel: 'Trip cancelled',
    operationalPhase: 'EXCEPTION',
    sortOrder: 100,
  },
  NO_SHOW: {
    internalStatus: 'NO_SHOW',
    displayStatus: 'NO_SHOW',
    displayLabel: 'No Show',
    timelineLabel: 'Rider no-show',
    operationalPhase: 'EXCEPTION',
    sortOrder: 110,
  },
};

/** Derived display when geofence/ETA indicates approaching but status not yet advanced. */
export function deriveApproachingDisplay(
  internalStatus: TripStatus,
  context: { nearPickup?: boolean; nearDropoff?: boolean },
): DisplayStatus | null {
  if (context.nearPickup && (internalStatus === 'ON_THE_WAY' || internalStatus === 'PRE_TRIP')) {
    return 'ARRIVING_PICKUP';
  }
  if (context.nearDropoff && (internalStatus === 'EN_ROUTE_DROPOFF' || internalStatus === 'PICKED_UP')) {
    return 'ARRIVING_DROPOFF';
  }
  return null;
}

export function getStatusCatalogEntry(status: TripStatus): StatusCatalogEntry {
  return CATALOG[status];
}

export function getDisplayLabel(status: TripStatus, context?: { nearPickup?: boolean; nearDropoff?: boolean }): string {
  const approaching = context ? deriveApproachingDisplay(status, context) : null;
  if (approaching === 'ARRIVING_PICKUP') return 'Arriving at Pickup';
  if (approaching === 'ARRIVING_DROPOFF') return 'Arriving at Drop-off';
  return CATALOG[status].displayLabel;
}

export function getAllowedActions(
  status: TripStatus,
  role: 'DRIVER' | 'ADMIN' | 'PARENT',
): TripStatus[] {
  if (role === 'DRIVER') return DRIVER_TRANSITIONS[status] ?? [];
  if (role === 'ADMIN') return ADMIN_EXTRA_TRANSITIONS[status] ?? [];
  if (role === 'PARENT' && ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP'].includes(status)) {
    return ['CANCELLED'];
  }
  return [];
}

export function mapInternalToDisplay(status: TripStatus): DisplayStatus {
  return CATALOG[status].displayStatus;
}

export const EVENT_DISPLAY_LABELS: Record<string, string> = {
  DRIVER_ASSIGNED: 'Driver assigned',
  LOCATION_SHARING_STARTED: 'Location sharing started',
  LOCATION_SHARING_STOPPED: 'Location sharing stopped',
  CHAT_OPENED: 'Chat opened',
  CHAT_CLOSED: 'Chat closed',
  FIVE_MINUTES_TO_PICKUP: 'About 5 minutes to pickup',
  FIVE_MINUTES_TO_DROPOFF: 'About 5 minutes to drop-off',
  NEAR_PICKUP: 'Near pickup',
  NEAR_DROPOFF: 'Near drop-off',
  ARRIVED_PICKUP: 'Arrived at pickup',
  RIDER_PICKED_UP: 'Rider picked up',
  ARRIVED_DROPOFF: 'Arrived at drop-off',
  COMPLETED: 'Trip completed',
  DRIVER_LATE: 'Driver late',
  RIDER_LATE: 'Rider late',
  NO_SHOW: 'No show',
  MODERATION_FLAGGED: 'Chat flagged',
  STATUS_CHANGED: 'Status changed',
};
