/**
 * Saudi-focused forward & reverse geocoding (server-side only).
 * Local registry first; ORS/Nominatim fallback.
 */

import { haversineDistanceMeters } from '../location/locationDistance.ts';
import { getLocalPlaceSnapRadiusMeters } from './mapPlaceConfig.ts';
import { mergeGeocodeResults } from './mergeGeocodeResults.ts';
import { mapPlaceTypeLabel } from './mapPlaceTypes.ts';
import type { MapPlaceType } from '@prisma/client';
import {
  confidenceForExternal,
  confidenceForLocal,
  needsAdminReview,
} from './confidence.ts';
import type {
  GeocodeFocus,
  GeocodeProviderTag,
  GeocodeSearchOptions,
  GeocodeSearchResult,
  LocalMapPlaceHit,
  ReverseGeocodeProvider,
  ReverseGeocodeResult,
} from './geocodeTypes.ts';

export type {
  GeocodeFocus,
  GeocodeProviderTag,
  GeocodeSearchOptions,
  GeocodeSearchResult,
  ReverseGeocodeProvider,
  ReverseGeocodeResult,
  GeocodeSource,
  GeocodeProviderBadge,
} from './geocodeTypes.ts';

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

const ORS_BASE = 'https://api.openrouteservice.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const DEFAULT_LIMIT = 8;

/** Saudi Arabia bounding rectangle for geocode bias. */
export const SAUDI_RECT = {
  minLng: 34.5,
  minLat: 16.0,
  maxLng: 55.7,
  maxLat: 32.2,
};

function getOrsApiKey(): string | null {
  const key = process.env.OPENROUTESERVICE_API_KEY?.trim();
  return key || null;
}

export function isOrsGeocodingConfigured(): boolean {
  return !!getOrsApiKey();
}

function acceptLanguage(lang?: string): string {
  return lang === 'ar' ? 'ar' : 'en';
}

function withinSaudi(lat: number, lng: number): boolean {
  return (
    lat >= SAUDI_RECT.minLat &&
    lat <= SAUDI_RECT.maxLat &&
    lng >= SAUDI_RECT.minLng &&
    lng <= SAUDI_RECT.maxLng
  );
}

/** Build a concise user-facing label from structured address parts. */
export function formatPlaceLabel(parts: {
  landmark?: string | null;
  name?: string | null;
  road?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  fallback?: string;
}): string {
  const landmark = parts.landmark?.trim() || parts.name?.trim();
  const road = parts.road?.trim();
  const neighborhood = parts.neighborhood?.trim();
  const city = parts.city?.trim();

  if (landmark) {
    const locality = [neighborhood, city].filter(Boolean).join(', ');
    if (locality && !landmark.includes(locality)) return `${landmark}, ${locality}`;
    return landmark;
  }

  if (road && neighborhood) return `${road}, ${neighborhood}`;
  if (road && city) return `${road}, ${city}`;
  if (road) return road;
  if (neighborhood && city) return `${neighborhood}, ${city}`;
  if (neighborhood) return neighborhood;
  if (city) return city;

  const fallback = parts.fallback?.trim();
  if (fallback && fallback.length >= 3) return fallback;
  return fallback ?? '';
}

export function formatPlaceSubtitle(parts: {
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  const items = [
    parts.neighborhood?.trim(),
    parts.city?.trim(),
    parts.region?.trim(),
    parts.country?.trim() ?? 'Saudi Arabia',
  ].filter(Boolean);
  const unique: string[] = [];
  for (const item of items) {
    if (!unique.some((u) => u.toLowerCase() === item!.toLowerCase())) unique.push(item!);
  }
  return unique.slice(0, 3).join(' · ') || 'Saudi Arabia';
}

function normalizeSearchResult(
  raw: Omit<GeocodeSearchResult, 'title' | 'subtitle' | 'source' | 'providerBadge'> & {
    title?: string;
    subtitle?: string;
    source?: GeocodeSearchResult['source'];
    providerBadge?: GeocodeSearchResult['providerBadge'];
  },
): GeocodeSearchResult {
  const title = raw.title?.trim() || raw.label.trim();
  const subtitle =
    raw.subtitle?.trim() ||
    formatPlaceSubtitle({
      neighborhood: raw.neighborhood,
      city: raw.city,
      region: raw.region,
      country: raw.country,
    });
  const source = raw.source ?? (raw.provider === 'openrouteservice' ? 'ORS' : raw.provider === 'nominatim' ? 'NOMINATIM' : 'LOCAL');
  const providerBadge =
    raw.providerBadge ??
    (source === 'LOCAL' ? (raw.isVerified ? 'Verified' : 'Local') : source === 'ORS' ? 'ORS' : 'OSM');

  let confidenceLevel = raw.confidenceLevel;
  if (!confidenceLevel) {
    if (source === 'LOCAL') confidenceLevel = confidenceForLocal(!!raw.isVerified);
    else if (source === 'ORS') {
      confidenceLevel = confidenceForExternal('ORS', {
        hasLandmark: !!raw.type,
        hasNeighborhood: !!raw.neighborhood,
      });
    } else confidenceLevel = confidenceForExternal('NOMINATIM', { hasLandmark: !!raw.neighborhood });
  }

  const reviewNeeded =
    raw.needsAdminReview ??
    needsAdminReview(confidenceLevel, source === 'LOCAL' ? 'LOCAL' : source, raw.isVerified);

  return {
    ...raw,
    label: raw.label.trim() || title,
    title,
    subtitle,
    source,
    providerBadge,
    confidence: raw.confidence ?? (confidenceLevel === 'HIGH' ? 1 : confidenceLevel === 'MEDIUM' ? 0.75 : 0.45),
    confidenceLevel,
    needsAdminReview: reviewNeeded,
  };
}

function localHitToGeocodeResult(hit: LocalMapPlaceHit, lang: 'ar' | 'en'): GeocodeSearchResult {
  const title = lang === 'ar' ? hit.nameAr : hit.nameEn;
  const alt = lang === 'ar' ? hit.nameEn : hit.nameAr;
  const subtitle = formatPlaceSubtitle({
    city: hit.city,
    region: hit.region,
    country: hit.country === 'SA' ? 'Saudi Arabia' : hit.country,
  });
  return normalizeSearchResult({
    label: title,
    title,
    subtitle: `${mapPlaceTypeLabel(hit.type as MapPlaceType, lang)} · ${subtitle}${alt && alt !== title ? ` · ${alt}` : ''}`,
    latitude: hit.latitude,
    longitude: hit.longitude,
    provider: 'local',
    source: 'LOCAL',
    providerBadge: hit.isVerified ? 'Verified' : 'Local',
    placeId: hit.id,
    type: hit.type,
    city: hit.city,
    region: hit.region ?? undefined,
    country: hit.country === 'SA' ? 'Saudi Arabia' : hit.country,
    isVerified: hit.isVerified,
    confidence: hit.isVerified ? 1 : 0.92,
  });
}

function localHitToReverseResult(hit: LocalMapPlaceHit, lang: 'ar' | 'en'): ReverseGeocodeResult {
  const title = lang === 'ar' ? hit.nameAr : hit.nameEn;
  const confidenceLevel = confidenceForLocal(hit.isVerified);
  return {
    label: title,
    city: hit.city,
    region: hit.region ?? undefined,
    country: hit.country === 'SA' ? 'Saudi Arabia' : hit.country,
    latitude: hit.latitude,
    longitude: hit.longitude,
    provider: 'LOCAL',
    source: 'LOCAL',
    providerBadge: hit.isVerified ? 'Verified' : 'Local',
    placeId: hit.id,
    isVerified: hit.isVerified,
    isLocalSnap: true,
    distanceMeters: hit.distanceMeters,
    landmark: title,
    confidenceLevel,
    needsAdminReview: needsAdminReview(confidenceLevel, 'LOCAL', hit.isVerified),
  };
}

function applySaudiBiasOrs(url: URL, options?: GeocodeSearchOptions): void {
  url.searchParams.set('boundary.country', 'SA');
  url.searchParams.set('boundary.rect.min_lon', String(SAUDI_RECT.minLng));
  url.searchParams.set('boundary.rect.min_lat', String(SAUDI_RECT.minLat));
  url.searchParams.set('boundary.rect.max_lon', String(SAUDI_RECT.maxLng));
  url.searchParams.set('boundary.rect.max_lat', String(SAUDI_RECT.maxLat));

  const focus = options?.focus;
  if (focus?.lat != null && focus?.lng != null && Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
    url.searchParams.set('focus.point.lon', String(focus.lng));
    url.searchParams.set('focus.point.lat', String(focus.lat));
    url.searchParams.set('focus.point.radius', '80');
  }
}

function applyViewboxNominatim(url: URL, options?: GeocodeSearchOptions): void {
  const vb = options?.focus?.viewbox;
  if (vb) {
    url.searchParams.set('viewbox', `${vb.minLng},${vb.maxLat},${vb.maxLng},${vb.minLat}`);
    url.searchParams.set('bounded', '1');
  } else if (options?.focus?.lng != null && options?.focus?.lat != null) {
    const pad = 0.35;
    const lng = options.focus.lng;
    const lat = options.focus.lat;
    url.searchParams.set('viewbox', `${lng - pad},${lat + pad},${lng + pad},${lat - pad}`);
  }
}

async function searchLocationsOrs(
  query: string,
  options?: GeocodeSearchOptions,
): Promise<GeocodeSearchResult[]> {
  const apiKey = getOrsApiKey();
  if (!apiKey) return [];

  const lang = options?.lang === 'ar' ? 'ar' : 'en';
  const { getForwardGeocodeCache, setForwardGeocodeCache } = await import('./geocodeCache.ts');
  const cached = await getForwardGeocodeCache(query, lang, 'ors');
  if (cached) return cached;

  const url = new URL(`${ORS_BASE}/geocode/search`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('text', query.trim());
  url.searchParams.set('size', String(options?.limit ?? DEFAULT_LIMIT));
  applySaudiBiasOrs(url, options);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage(options?.lang),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new GeocodingError('Geocoding service returned an error.');

  const json = (await res.json()) as { features?: unknown[] };
  const features = json.features ?? [];

  const results = features
    .map((f) => {
      const feature = f as {
        geometry: { coordinates: [number, number] };
        properties: {
          label?: string;
          id?: string;
          name?: string;
          street?: string;
          neighbourhood?: string;
          locality?: string;
          region?: string;
          country?: string;
        };
      };
      const [lng, lat] = feature.geometry.coordinates;
      if (!withinSaudi(lat, lng)) return null;

      const neighborhood = feature.properties.neighbourhood ?? undefined;
      const city = feature.properties.locality ?? undefined;
      const region = feature.properties.region ?? undefined;
      const country = feature.properties.country ?? 'Saudi Arabia';
      const title = formatPlaceLabel({
        name: feature.properties.name,
        road: feature.properties.street,
        neighborhood,
        city,
        fallback: feature.properties.label ?? feature.properties.name,
      });

      return normalizeSearchResult({
        label: feature.properties.label ?? title,
        title,
        latitude: lat,
        longitude: lng,
        provider: 'openrouteservice',
        source: 'ORS',
        providerBadge: 'ORS',
        providerPlaceId: feature.properties.id ?? undefined,
        neighborhood,
        city,
        region,
        country,
      });
    })
    .filter((r): r is GeocodeSearchResult => r != null);

  await setForwardGeocodeCache(query, lang, 'ors', results, results.length > 0);
  return results;
}

type NominatimAddress = {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
  amenity?: string;
  building?: string;
  tourism?: string;
  historic?: string;
};

async function searchLocationsNominatim(
  query: string,
  options?: GeocodeSearchOptions,
): Promise<GeocodeSearchResult[]> {
  const lang = options?.lang === 'ar' ? 'ar' : 'en';
  const { getForwardGeocodeCache, setForwardGeocodeCache } = await import('./geocodeCache.ts');
  const cached = await getForwardGeocodeCache(query, lang, 'nominatim');
  if (cached) return cached;

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(options?.limit ?? DEFAULT_LIMIT));
  url.searchParams.set('countrycodes', 'sa');
  url.searchParams.set('accept-language', acceptLanguage(options?.lang));
  applyViewboxNominatim(url, options);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FizzaWeb/1.0 (school transport; saudi geocode)',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const rows = (await res.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    place_id?: number;
    name?: string;
    address?: NominatimAddress;
  }[];

  const results = rows
    .filter((r) => r.lat && r.lon)
    .map((r) => {
      const addr = r.address ?? {};
      const neighborhood = addr.neighbourhood ?? addr.suburb ?? addr.quarter;
      const city = addr.city ?? addr.town ?? addr.village;
      const landmark = addr.amenity ?? addr.tourism ?? addr.historic ?? addr.building;
      const title = formatPlaceLabel({
        landmark,
        name: r.name,
        road: addr.road,
        neighborhood,
        city,
        fallback: r.display_name ?? query.trim(),
      });

      return normalizeSearchResult({
        label: r.display_name ?? title,
        title,
        latitude: Number(r.lat),
        longitude: Number(r.lon),
        provider: 'nominatim',
        source: 'NOMINATIM',
        providerBadge: 'OSM',
        providerPlaceId: r.place_id != null ? String(r.place_id) : undefined,
        neighborhood,
        city,
        region: addr.state,
        country: addr.country ?? 'Saudi Arabia',
      });
    })
    .filter((r) => withinSaudi(r.latitude, r.longitude));

  await setForwardGeocodeCache(query, lang, 'nominatim', results, results.length > 0);
  return results;
}

/** Local-first Saudi location search with external fallback. */
export async function searchLocations(
  query: string,
  options?: GeocodeSearchOptions,
): Promise<GeocodeSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const lang = options?.lang === 'ar' ? 'ar' : 'en';
  const limit = options?.limit ?? DEFAULT_LIMIT;

  const { searchLocalMapPlaces } = await import('./localPlaceSearch.ts');
  const localHits = await searchLocalMapPlaces(query, lang, limit);
  const localResults = localHits.map((h) => localHitToGeocodeResult(h, lang));

  let external: GeocodeSearchResult[] = [];

  if (isOrsGeocodingConfigured()) {
    try {
      external = await searchLocationsOrs(query, options);
    } catch {
      // continue to Nominatim
    }
  }

  if (external.length === 0) {
    try {
      external = await searchLocationsNominatim(query, options);
    } catch {
      // external unavailable
    }
  }

  const merged = mergeGeocodeResults(localResults, external, limit);
  if (merged.length) return merged;

  return [];
}

function nominatimReverseToResult(
  json: {
    display_name?: string;
    name?: string;
    address?: NominatimAddress;
  },
  lat: number,
  lng: number,
): ReverseGeocodeResult {
  const addr = json.address ?? {};
  const neighborhood = addr.neighbourhood ?? addr.suburb ?? addr.quarter;
  const city = addr.city ?? addr.town ?? addr.village;
  const landmark = addr.amenity ?? addr.tourism ?? addr.historic ?? addr.building;
  const label = formatPlaceLabel({
    landmark,
    name: json.name,
    road: addr.road,
    neighborhood,
    city,
    fallback: json.display_name,
  });

  const confidenceLevel = confidenceForExternal('NOMINATIM', {
    hasLandmark: !!landmark,
    hasNeighborhood: !!neighborhood,
  });

  return {
    label: label || json.display_name || '',
    neighborhood,
    road: addr.road,
    landmark: landmark ?? undefined,
    city,
    region: addr.state,
    country: addr.country ?? 'Saudi Arabia',
    latitude: lat,
    longitude: lng,
    provider: 'NOMINATIM',
    source: 'NOMINATIM',
    providerBadge: 'OSM',
    confidenceLevel,
    needsAdminReview: needsAdminReview(confidenceLevel, 'NOMINATIM'),
  };
}

async function reverseGeocodeOrs(
  lat: number,
  lng: number,
  options?: { lang?: string },
): Promise<ReverseGeocodeResult | null> {
  const apiKey = getOrsApiKey();
  if (!apiKey) return null;

  const lang = options?.lang === 'ar' ? 'ar' : 'en';
  const { getReverseGeocodeCache, setReverseGeocodeCache } = await import('./geocodeCache.ts');
  const cached = await getReverseGeocodeCache(lat, lng, lang, 'ors');
  if (cached) return cached;

  const url = new URL(`${ORS_BASE}/geocode/reverse`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('point.lon', String(lng));
  url.searchParams.set('point.lat', String(lat));
  url.searchParams.set('boundary.country', 'SA');
  url.searchParams.set('size', '1');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage(options?.lang),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { features?: unknown[] };
  const feature = json.features?.[0] as
    | {
        geometry: { coordinates: [number, number] };
        properties: {
          label?: string;
          name?: string;
          street?: string;
          neighbourhood?: string;
          locality?: string;
          region?: string;
          country?: string;
        };
      }
    | undefined;
  if (!feature) return null;

  const neighborhood = feature.properties.neighbourhood;
  const city = feature.properties.locality;
  const label = formatPlaceLabel({
    name: feature.properties.name,
    road: feature.properties.street,
    neighborhood,
    city,
    fallback: feature.properties.label ?? feature.properties.name,
  });

  if (!label || label.length < 3) return null;

  const confidenceLevel = confidenceForExternal('ORS', {
    hasLandmark: !!feature.properties.name,
    hasNeighborhood: !!neighborhood,
  });
  const result: ReverseGeocodeResult = {
    label,
    neighborhood,
    road: feature.properties.street,
    landmark: feature.properties.name,
    city,
    region: feature.properties.region,
    country: feature.properties.country ?? 'Saudi Arabia',
    latitude: lat,
    longitude: lng,
    provider: 'ORS',
    source: 'ORS',
    providerBadge: 'ORS',
    confidenceLevel,
    needsAdminReview: needsAdminReview(confidenceLevel, 'ORS'),
  };
  await setReverseGeocodeCache(lat, lng, lang, 'ors', result, true);
  return result;
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
  options?: { lang?: string },
): Promise<ReverseGeocodeResult | null> {
  const lang = options?.lang === 'ar' ? 'ar' : 'en';
  const { getReverseGeocodeCache, setReverseGeocodeCache } = await import('./geocodeCache.ts');
  const cached = await getReverseGeocodeCache(lat, lng, lang, 'nominatim');
  if (cached) return cached;

  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', acceptLanguage(options?.lang));
  url.searchParams.set('zoom', '18');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FizzaWeb/1.0 (school transport; saudi reverse geocode)',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    error?: string;
    display_name?: string;
    name?: string;
    address?: NominatimAddress;
  };
  if (json.error) return null;

  const result = nominatimReverseToResult(json, lat, lng);
  if (result.label.length < 3) {
    await setReverseGeocodeCache(lat, lng, lang, 'nominatim', null, false);
    return null;
  }
  await setReverseGeocodeCache(lat, lng, lang, 'nominatim', result, true);
  return result;
}

/** Reverse geocode — local snap first, then ORS/Nominatim. */
export async function reverseGeocodeLocation(
  lat: number,
  lng: number,
  options?: { lang?: string },
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!withinSaudi(lat, lng)) return null;

  const lang = options?.lang === 'ar' ? 'ar' : 'en';
  const radius = getLocalPlaceSnapRadiusMeters();
  const { findNearestLocalMapPlace } = await import('./localPlaceSearch.ts');
  const nearest = await findNearestLocalMapPlace(lat, lng, radius);
  if (nearest) {
    return localHitToReverseResult(nearest, lang);
  }

  if (isOrsGeocodingConfigured()) {
    try {
      const ors = await reverseGeocodeOrs(lat, lng, options);
      if (ors) return ors;
    } catch {
      // fall through
    }
  }

  try {
    return await reverseGeocodeNominatim(lat, lng, options);
  } catch {
    return null;
  }
}

/** Provider badge label for legacy UI helpers. */
export function geocodeProviderBadge(
  provider: GeocodeProviderTag | ReverseGeocodeProvider | GeocodeSearchResult['source'],
): string {
  if (provider === 'local' || provider === 'LOCAL') return 'Local';
  if (provider === 'openrouteservice' || provider === 'ORS') return 'ORS';
  return 'OSM';
}
