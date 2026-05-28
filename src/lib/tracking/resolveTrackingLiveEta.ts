/**
 * Shared live ETA computation for tracking routes (main GET only — polls use cache).
 */
import { calculateLiveEtaForTrip } from '@/lib/trips/tripEta';
import { getTripOpsConfig } from '@/lib/trips/tripConfig';
import { getOrComputeLiveEta, invalidateLiveEtaCache } from '@/lib/tracking/liveEtaCache';
import type { LiveEtaInfo } from '@/lib/tracking/trackingTypes';
import { isTerminalTripStatus } from '@/lib/tracking/trackingVisibility';

type TripCoords = {
  status: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
};

export async function resolveTrackingLiveEta(
  tripId: string,
  trip: TripCoords,
  location: { lat: number; lng: number } | null,
  options?: { force?: boolean },
): Promise<LiveEtaInfo | null> {
  if (!location || isTerminalTripStatus(trip.status)) {
    invalidateLiveEtaCache(tripId);
    return null;
  }

  return getOrComputeLiveEta(
    tripId,
    async () => {
      const config = await getTripOpsConfig();
      return calculateLiveEtaForTrip(
        trip.status,
        location.lat,
        location.lng,
        trip.pickupLat,
        trip.pickupLng,
        trip.dropoffLat,
        trip.dropoffLng,
        config,
      );
    },
    options,
  );
}
