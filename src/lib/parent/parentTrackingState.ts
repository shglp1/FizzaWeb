/**
 * Parent tracking state resolver — school transport friendly statuses.
 */

import type { TripStatus } from '../trips/tripLifecycle.ts';
import { isActiveStatus, isParentLocationVisible, isTrackableStatus } from '../trips/tripLifecycle.ts';
import { haversineMetres } from '../trips/tripLifecycle.ts';
import type { DriverLocationSnapshot, LiveEtaInfo, TripLegType } from '../tracking/trackingTypes.ts';
import { minutesUntil } from './parentTrackingFormatters.ts';

export type ParentTrackingStateId =
  | 'driver_not_assigned'
  | 'waiting_for_window'
  | 'waiting_for_location'
  | 'driver_assigned'
  | 'driver_en_route_to_pickup'
  | 'driver_minutes_away'
  | 'arriving_soon'
  | 'driver_at_pickup'
  | 'student_picked_up'
  | 'en_route_to_school'
  | 'en_route_to_home'
  | 'arrived_at_destination'
  | 'arrived_home'
  | 'trip_completed'
  | 'location_unavailable'
  | 'gps_outdated'
  | 'trip_cancelled'
  | 'no_show';

export type ParentTrackingState = {
  id: ParentTrackingStateId;
  showLiveMap: boolean;
  showDriverMarker: boolean;
  etaMinutes: number | null;
  etaTarget: 'pickup' | 'dropoff' | 'scheduled' | null;
  minutesToScheduledPickup: number | null;
  heading: 'pickup' | 'dropoff' | 'none';
};

const ARRIVING_SOON_METRES = 500;
const MINUTES_AWAY_THRESHOLD = 15;

function statusPhase(status: TripStatus): number {
  const map: Record<string, number> = {
    SCHEDULED: 0,
    DRIVER_ASSIGNED: 1,
    PRE_TRIP: 2,
    ON_THE_WAY: 3,
    ARRIVED_PICKUP: 4,
    PICKED_UP: 5,
    EN_ROUTE_DROPOFF: 6,
    ARRIVED_DROPOFF: 7,
    COMPLETED: 8,
  };
  return map[status] ?? 0;
}

function distanceToTarget(
  location: DriverLocationSnapshot | null,
  targetLat: number | null,
  targetLng: number | null,
): number | null {
  if (!location || targetLat == null || targetLng == null) return null;
  return haversineMetres(location.lat, location.lng, targetLat, targetLng);
}

export function resolveParentTrackingState(input: {
  status: string;
  legType?: TripLegType | null;
  hasDriver: boolean;
  location: DriverLocationSnapshot | null;
  scheduledPickupTime: string | null;
  actualPickupTime?: string | null;
  actualDropoffTime?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  liveEta?: LiveEtaInfo | null;
  nowMs?: number;
}): ParentTrackingState {
  const nowMs = input.nowMs ?? Date.now();
  const status = input.status as TripStatus;
  const minsToPickup = minutesUntil(input.scheduledPickupTime, nowMs);
  const canSeeLocation = isParentLocationVisible(status, input.scheduledPickupTime ? new Date(input.scheduledPickupTime) : null, nowMs);
  const trackable = isTrackableStatus(status);
  const isReturn = input.legType === 'RETURN';

  const base: ParentTrackingState = {
    id: 'driver_assigned',
    showLiveMap: true,
    showDriverMarker: false,
    etaMinutes: null,
    etaTarget: null,
    minutesToScheduledPickup: minsToPickup,
    heading: 'none',
  };

  if (status === 'CANCELLED') return { ...base, id: 'trip_cancelled', showLiveMap: false, heading: 'none' };
  if (status === 'NO_SHOW') return { ...base, id: 'no_show', showLiveMap: false, heading: 'none' };
  if (status === 'COMPLETED') {
    return { ...base, id: 'trip_completed', showLiveMap: false, heading: 'none' };
  }

  if (!input.hasDriver) {
    return { ...base, id: 'driver_not_assigned', showDriverMarker: false, heading: 'none' };
  }

  if (!canSeeLocation && !trackable) {
    if (minsToPickup != null && minsToPickup > 10) {
      return { ...base, id: 'waiting_for_window', showDriverMarker: false, etaTarget: 'scheduled', heading: 'none' };
    }
    return { ...base, id: 'driver_assigned', showDriverMarker: false, heading: 'none' };
  }

  const loc = input.location;
  if (loc?.stale) {
    return {
      ...base,
      id: 'gps_outdated',
      showDriverMarker: true,
      etaMinutes: input.liveEta?.liveEtaMinutes ?? null,
      etaTarget: input.liveEta?.etaTarget ?? null,
      heading: resolveHeading(status, isReturn),
    };
  }

  if (!loc && trackable) {
    return { ...base, id: 'waiting_for_location', showDriverMarker: false, heading: resolveHeading(status, isReturn) };
  }

  if (!loc) {
    return { ...base, id: 'location_unavailable', showDriverMarker: false, heading: 'none' };
  }

  const liveEtaMin = input.liveEta?.liveEtaMinutes ?? null;
  const etaTarget = input.liveEta?.etaTarget ?? null;

  if (status === 'ARRIVED_PICKUP') {
    return { ...base, id: 'driver_at_pickup', showDriverMarker: true, heading: 'pickup' };
  }
  if (status === 'PICKED_UP') {
    return { ...base, id: 'student_picked_up', showDriverMarker: true, heading: 'dropoff' };
  }
  if (status === 'ARRIVED_DROPOFF') {
    return {
      ...base,
      id: isReturn ? 'arrived_home' : 'arrived_at_destination',
      showDriverMarker: true,
      heading: 'dropoff',
    };
  }
  if (status === 'EN_ROUTE_DROPOFF') {
    const dist = distanceToTarget(loc, input.dropoffLat ?? null, input.dropoffLng ?? null);
    if (dist != null && dist <= ARRIVING_SOON_METRES) {
      return {
        ...base,
        id: 'arriving_soon',
        showDriverMarker: true,
        etaMinutes: liveEtaMin,
        etaTarget: etaTarget ?? 'dropoff',
        heading: 'dropoff',
      };
    }
    if (liveEtaMin != null && liveEtaMin <= MINUTES_AWAY_THRESHOLD) {
      return {
        ...base,
        id: 'driver_minutes_away',
        showDriverMarker: true,
        etaMinutes: liveEtaMin,
        etaTarget: etaTarget ?? 'dropoff',
        heading: 'dropoff',
      };
    }
    return {
      ...base,
      id: isReturn ? 'en_route_to_home' : 'en_route_to_school',
      showDriverMarker: true,
      etaMinutes: liveEtaMin,
      etaTarget: etaTarget ?? 'dropoff',
      heading: 'dropoff',
    };
  }

  if (status === 'ON_THE_WAY' || status === 'PRE_TRIP' || status === 'DRIVER_ASSIGNED') {
    const dist = distanceToTarget(loc, input.pickupLat ?? null, input.pickupLng ?? null);
    if (dist != null && dist <= ARRIVING_SOON_METRES) {
      return {
        ...base,
        id: 'arriving_soon',
        showDriverMarker: true,
        etaMinutes: liveEtaMin,
        etaTarget: etaTarget ?? 'pickup',
        heading: 'pickup',
      };
    }
    if (liveEtaMin != null && liveEtaMin <= MINUTES_AWAY_THRESHOLD) {
      return {
        ...base,
        id: 'driver_minutes_away',
        showDriverMarker: true,
        etaMinutes: liveEtaMin,
        etaTarget: etaTarget ?? 'pickup',
        heading: 'pickup',
      };
    }
    if (status === 'ON_THE_WAY' || isActiveStatus(status)) {
      return {
        ...base,
        id: 'driver_en_route_to_pickup',
        showDriverMarker: true,
        etaMinutes: liveEtaMin,
        etaTarget: etaTarget ?? 'pickup',
        heading: 'pickup',
      };
    }
    return { ...base, id: 'driver_assigned', showDriverMarker: true, heading: 'pickup' };
  }

  if (input.actualPickupTime && statusPhase(status) >= statusPhase('PICKED_UP')) {
    return { ...base, id: 'student_picked_up', showDriverMarker: true, heading: 'dropoff' };
  }

  return { ...base, id: 'driver_assigned', showDriverMarker: !!loc, heading: 'pickup' };
}

function resolveHeading(status: TripStatus, isReturn: boolean): 'pickup' | 'dropoff' | 'none' {
  if (['PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(status)) return 'dropoff';
  if (['ON_THE_WAY', 'PRE_TRIP', 'DRIVER_ASSIGNED', 'ARRIVED_PICKUP'].includes(status)) return 'pickup';
  if (isReturn && status === 'SCHEDULED') return 'pickup';
  return 'none';
}

/** Safety timeline step keys for parent UI. */
export type ParentSafetyStep = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  time?: string | null;
};

export function buildParentSafetyTimeline(input: {
  status: string;
  legType?: TripLegType | null;
  actualPickupTime?: string | null;
  actualDropoffTime?: string | null;
  lang?: 'en' | 'ar';
}): ParentSafetyStep[] {
  const isReturn = input.legType === 'RETURN';
  const status = input.status as TripStatus;
  const phase = statusPhase(status);
  const cancelled = status === 'CANCELLED' || status === 'NO_SHOW';

  if (cancelled) {
    return [{ key: 'cancelled', label: status === 'NO_SHOW' ? 'No show' : 'Cancelled', done: true, active: true }];
  }

  const destArrivedLabel = isReturn ? 'Arrived home' : 'Arrived at school';

  return [
    { key: 'assigned', label: 'Driver assigned', done: phase >= 1, active: phase === 1, time: null },
    { key: 'enroute', label: 'On the way to pickup', done: phase >= 3, active: phase === 2 || phase === 3, time: null },
    { key: 'pickup', label: 'Student picked up', done: phase >= 5, active: phase === 4, time: input.actualPickupTime ?? null },
    {
      key: 'dropoff',
      label: isReturn ? 'On the way home' : 'On the way to school',
      done: phase >= 7,
      active: phase === 6,
      time: null,
    },
    { key: 'arrived', label: destArrivedLabel, done: phase >= 7, active: phase === 7, time: null },
    {
      key: 'done',
      label: 'Arrived safely',
      done: phase >= 8,
      active: phase === 8,
      time: input.actualDropoffTime ?? null,
    },
  ];
}
