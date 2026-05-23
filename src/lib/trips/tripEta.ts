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
