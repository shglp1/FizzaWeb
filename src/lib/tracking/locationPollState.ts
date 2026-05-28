/**
 * Pure client-side reducer for location poll responses.
 */

import type { DriverLocationSnapshot, LiveEtaInfo, TrackingTrip } from './trackingTypes.ts';
import { isTerminalTripStatus, parentCanSeeLiveLocation } from './trackingVisibility.ts';

export type LocationPollPayload = {
  location: DriverLocationSnapshot | null;
  tooEarly?: boolean;
  trackingVisible?: boolean;
  terminal?: boolean;
  tripStatus?: string;
  liveEta?: LiveEtaInfo | null;
};

function normalizeLocation(raw: unknown): DriverLocationSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const loc = raw as Record<string, unknown>;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    recordedAt: String(loc.recordedAt ?? new Date().toISOString()),
    stale: Boolean(loc.stale),
  };
}

export type LocationPollStateUpdate = {
  trip: TrackingTrip | null;
  location: DriverLocationSnapshot | null;
  liveEta: LiveEtaInfo | null | undefined;
  tooEarly: boolean;
  stopPolling: boolean;
};

/**
 * Apply a location poll payload to current tracking state.
 * Clears driver location when tracking is no longer visible or trip is terminal.
 */
export function applyLocationPollUpdate(
  currentTrip: TrackingTrip | null,
  poll: LocationPollPayload | null | undefined,
): LocationPollStateUpdate {
  if (!poll) {
    return {
      trip: currentTrip,
      location: currentTrip ? null : null,
      liveEta: null,
      tooEarly: false,
      stopPolling: false,
    };
  }

  const tripStatus = poll.tripStatus ?? currentTrip?.status ?? '';
  const terminal = poll.terminal ?? isTerminalTripStatus(tripStatus);
  const trackingVisible =
    poll.trackingVisible ??
    (currentTrip
      ? parentCanSeeLiveLocation(tripStatus, currentTrip.scheduledPickupTime)
      : false);

  const trip =
    currentTrip && poll.tripStatus && poll.tripStatus !== currentTrip.status
      ? { ...currentTrip, status: poll.tripStatus }
      : currentTrip;

  const tooEarly = Boolean(poll.tooEarly);

  if (terminal || tooEarly || !trackingVisible) {
    return {
      trip,
      location: null,
      liveEta: null,
      tooEarly,
      stopPolling: terminal,
    };
  }

  const location = normalizeLocation(poll.location);

  return {
    trip,
    location,
    liveEta: poll.liveEta !== undefined ? poll.liveEta : undefined,
    tooEarly: false,
    stopPolling: false,
  };
}
