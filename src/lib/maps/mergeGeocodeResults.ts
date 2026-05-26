import { haversineDistanceMeters } from '../location/locationDistance.ts';
import type { GeocodeSearchResult } from './geocodeTypes.ts';
import { MAP_PLACE_DEDUPE_METERS } from './mapPlaceConfig.ts';

/** Merge local + external geocode hits; local first; dedupe by proximity. */
export function mergeGeocodeResults(
  local: GeocodeSearchResult[],
  external: GeocodeSearchResult[],
  limit = 8,
): GeocodeSearchResult[] {
  const merged: GeocodeSearchResult[] = [...local];

  for (const ext of external) {
    const dup = merged.some(
      (m) =>
        haversineDistanceMeters(m.latitude, m.longitude, ext.latitude, ext.longitude) <
        MAP_PLACE_DEDUPE_METERS,
    );
    if (!dup) merged.push(ext);
  }

  return merged.slice(0, limit);
}
