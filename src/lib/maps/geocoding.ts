/**
 * Saudi-focused forward & reverse geocoding (server-side only).
 * ORS when configured; Nominatim fallback. Never expose API keys to the client.
 */

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

export type GeocodeProviderTag = 'openrouteservice' | 'nominatim';

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
  providerPlaceId?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
}

export type ReverseGeocodeProvider = 'ORS' | 'NOMINATIM';

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
  raw: Omit<GeocodeSearchResult, 'title' | 'subtitle'> & { title?: string; subtitle?: string },
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
  return {
    ...raw,
    label: raw.label.trim() || title,
    title,
    subtitle,
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

  return features
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
        providerPlaceId: feature.properties.id ?? undefined,
        neighborhood,
        city,
        region,
        country,
      });
    })
    .filter((r): r is GeocodeSearchResult => r != null);
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

  return rows
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
        providerPlaceId: r.place_id != null ? String(r.place_id) : undefined,
        neighborhood,
        city,
        region: addr.state,
        country: addr.country ?? 'Saudi Arabia',
      });
    })
    .filter((r) => withinSaudi(r.latitude, r.longitude));
}

/** Saudi-focused location search. ORS primary; Nominatim fallback. */
export async function searchLocations(
  query: string,
  options?: GeocodeSearchOptions,
): Promise<GeocodeSearchResult[]> {
  if (!query || query.trim().length < 3) return [];

  if (isOrsGeocodingConfigured()) {
    try {
      const results = await searchLocationsOrs(query, options);
      if (results.length) return results;
    } catch {
      // fall through to Nominatim
    }
  }

  try {
    const results = await searchLocationsNominatim(query, options);
    if (results.length) return results;
    throw new GeocodingError('No locations found in Saudi Arabia.');
  } catch (err) {
    if (err instanceof GeocodingError) throw err;
    throw new GeocodingError('Could not reach geocoding service. Please try again.');
  }
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
  };
}

async function reverseGeocodeOrs(
  lat: number,
  lng: number,
  options?: { lang?: string },
): Promise<ReverseGeocodeResult | null> {
  const apiKey = getOrsApiKey();
  if (!apiKey) return null;

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

  return {
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
  };
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
  options?: { lang?: string },
): Promise<ReverseGeocodeResult | null> {
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
  return result.label.length >= 3 ? result : null;
}

/** Reverse geocode coordinates to a human-readable Saudi place name. */
export async function reverseGeocodeLocation(
  lat: number,
  lng: number,
  options?: { lang?: string },
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!withinSaudi(lat, lng)) return null;

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

/** Provider badge label for UI (SA / ORS / OSM). */
export function geocodeProviderBadge(provider: GeocodeProviderTag | ReverseGeocodeProvider): string {
  if (provider === 'openrouteservice' || provider === 'ORS') return 'ORS';
  return 'OSM';
}
