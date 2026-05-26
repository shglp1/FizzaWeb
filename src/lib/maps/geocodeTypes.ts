/** Shared geocode result types — safe to import from client helpers/tests. */

export type LocalMapPlaceHit = {
  id: string;
  nameAr: string;
  nameEn: string;
  type: string;
  city: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  isVerified: boolean;
  distanceMeters?: number;
};

export type GeocodeSource = 'LOCAL' | 'ORS' | 'NOMINATIM';

export type LocationConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type GeocodeProviderBadge = 'Verified' | 'Local' | 'ORS' | 'OSM';

export type GeocodeProviderTag = 'local' | 'openrouteservice' | 'nominatim';

export type GeocodeFocus = {
  lat?: number;
  lng?: number;
  viewbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
};

export type GeocodeSearchOptions = {
  lang?: string;
  focus?: GeocodeFocus;
  limit?: number;
};

export interface GeocodeSearchResult {
  label: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  provider: GeocodeProviderTag;
  source: GeocodeSource;
  providerBadge: GeocodeProviderBadge;
  providerPlaceId?: string;
  placeId?: string;
  type?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  confidence?: number;
  confidenceLevel?: LocationConfidenceLevel;
  needsAdminReview?: boolean;
  isVerified?: boolean;
}

export type ReverseGeocodeProvider = 'LOCAL' | 'ORS' | 'NOMINATIM';

export interface ReverseGeocodeResult {
  label: string;
  neighborhood?: string;
  road?: string;
  landmark?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  provider: ReverseGeocodeProvider;
  source: GeocodeSource;
  providerBadge: GeocodeProviderBadge;
  placeId?: string;
  isVerified?: boolean;
  isLocalSnap?: boolean;
  distanceMeters?: number;
  confidenceLevel?: LocationConfidenceLevel;
  needsAdminReview?: boolean;
}
