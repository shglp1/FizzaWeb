/**
 * ETA calculation for trip proximity notifications.
 */
import { getDrivingDurationMinutes, estimateDurationMinutesFallback } from '../maps/distance.ts';
import { haversineMetres } from './tripLifecycle.ts';
import type { TripOpsConfig } from './tripConfig.ts';

export type EtaResult = {
  etaMinutes: number;
  distanceMeters: number;
  source: 'ORS' | 'FALLBACK';
};

export async function calculateEtaMinutes(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number,
  config: TripOpsConfig,
): Promise<EtaResult> {
  const distanceMeters = haversineMetres(driverLat, driverLng, destLat, destLng);
  const ors = await getDrivingDurationMinutes(
    { lat: driverLat, lng: driverLng },
    { lat: destLat, lng: destLng },
  );
  if (ors) {
    return { etaMinutes: ors.durationMinutes, distanceMeters: ors.distanceMeters, source: 'ORS' };
  }
  return {
    etaMinutes: estimateDurationMinutesFallback(distanceMeters, config.averageFallbackSpeedKmh),
    distanceMeters,
    source: 'FALLBACK',
  };
}

export function shouldTriggerNearEvent(
  etaMinutes: number,
  distanceMeters: number,
  thresholdMinutes: number,
  thresholdMeters: number,
): boolean {
  return etaMinutes <= thresholdMinutes || distanceMeters <= thresholdMeters;
}

export type LiveEtaTarget = 'pickup' | 'dropoff';

export function resolveEtaTarget(status: string): LiveEtaTarget | null {
  if (['ON_THE_WAY', 'PRE_TRIP', 'DRIVER_ASSIGNED', 'ARRIVED_PICKUP'].includes(status)) return 'pickup';
  if (['PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(status)) return 'dropoff';
  return null;
}

export async function calculateLiveEtaForTrip(
  status: string,
  driverLat: number,
  driverLng: number,
  pickupLat: number | null,
  pickupLng: number | null,
  dropoffLat: number | null,
  dropoffLng: number | null,
  config: TripOpsConfig,
): Promise<{ liveEtaMinutes: number | null; etaTarget: LiveEtaTarget; etaSource: 'ORS' | 'FALLBACK' | 'UNAVAILABLE' } | null> {
  const etaTarget = resolveEtaTarget(status);
  if (!etaTarget) return null;
  const destLat = etaTarget === 'pickup' ? pickupLat : dropoffLat;
  const destLng = etaTarget === 'pickup' ? pickupLng : dropoffLng;
  if (destLat == null || destLng == null) return null;
  try {
    const result = await calculateEtaMinutes(driverLat, driverLng, destLat, destLng, config);
    return {
      liveEtaMinutes: Math.max(1, Math.round(result.etaMinutes)),
      etaTarget,
      etaSource: result.source,
    };
  } catch {
    return { liveEtaMinutes: null, etaTarget, etaSource: 'UNAVAILABLE' };
  }
}
