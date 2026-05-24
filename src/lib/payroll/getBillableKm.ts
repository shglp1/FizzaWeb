import { getDrivingDurationMinutes } from '../maps/distance.ts';
import { haversineMetres } from '../trips/tripLifecycle.ts';
import { roundKm } from './calculateTripEarning.ts';

export type TripCoords = {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  billableKmOverride?: number | null;
};

export type BillableKmResult = {
  billableKm: number;
  kmSource: 'ROAD' | 'HAVERSINE' | 'MANUAL';
};

function haversineKm(trip: TripCoords): BillableKmResult | null {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = trip;
  if (
    pickupLat == null || pickupLng == null ||
    dropoffLat == null || dropoffLng == null
  ) {
    return null;
  }
  const metres = haversineMetres(pickupLat, pickupLng, dropoffLat, dropoffLng);
  return { billableKm: roundKm(metres / 1000), kmSource: 'HAVERSINE' };
}

/** Sync haversine-only — used in tests and as fallback. */
export function getBillableKmSync(trip: TripCoords): BillableKmResult | null {
  if (trip.billableKmOverride != null && trip.billableKmOverride > 0) {
    return { billableKm: roundKm(trip.billableKmOverride), kmSource: 'MANUAL' };
  }
  return haversineKm(trip);
}

/** Road distance via ORS when configured; haversine fallback otherwise. */
export async function getBillableKmForTrip(trip: TripCoords): Promise<BillableKmResult | null> {
  if (trip.billableKmOverride != null && trip.billableKmOverride > 0) {
    return { billableKm: roundKm(trip.billableKmOverride), kmSource: 'MANUAL' };
  }

  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = trip;
  if (
    pickupLat == null || pickupLng == null ||
    dropoffLat == null || dropoffLng == null
  ) {
    return null;
  }

  const route = await getDrivingDurationMinutes(
    { lat: pickupLat, lng: pickupLng },
    { lat: dropoffLat, lng: dropoffLng },
  );

  if (route && route.distanceMeters > 0) {
    return { billableKm: roundKm(route.distanceMeters / 1000), kmSource: 'ROAD' };
  }

  return haversineKm(trip);
}
