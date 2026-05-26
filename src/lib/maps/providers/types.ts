/** Map provider abstraction — ready for future Google/Mapbox/MapTiler without SDK changes now. */

import type { GeocodeSearchOptions, GeocodeSearchResult, ReverseGeocodeResult } from '../geocodeTypes.ts';

export type MapSearchProviderId =
  | 'local'
  | 'ors'
  | 'nominatim'
  | 'google'
  | 'mapbox'
  | 'maptiler'
  | 'here';

export type MapRouteProviderId = 'ors' | 'osrm' | 'google' | 'mapbox' | 'maptiler' | 'here';

export type MapProviderMode = 'AUTO' | MapSearchProviderId;

export interface MapSearchProvider {
  id: MapSearchProviderId;
  geocode(query: string, options?: GeocodeSearchOptions): Promise<GeocodeSearchResult[]>;
  reverse(lat: number, lng: number, options?: { lang?: string }): Promise<ReverseGeocodeResult | null>;
}

export interface MapRoutePoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface MapRouteResult {
  distanceKm: number;
  provider: MapRouteProviderId;
  approximate?: boolean;
}

export interface MapRouteProvider {
  id: MapRouteProviderId;
  route(start: MapRoutePoint, end: MapRoutePoint): Promise<MapRouteResult | null>;
}

/** Placeholder provider IDs documented for future integration — not implemented. */
export const FUTURE_MAP_PROVIDERS = ['google', 'mapbox', 'maptiler', 'here'] as const;
