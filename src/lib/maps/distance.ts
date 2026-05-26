/**
 * Server-side distance calculation and geocoding utilities.
 *
 * Uses OpenRouteService (ORS) by default. API key is read from environment
 * variables and is NEVER exposed to the client. All routing/geocoding calls
 * happen exclusively on the server.
 *
 * Architecture: DistanceProvider union type allows adding Google Maps or Mapbox
 * in future without changing call sites.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DistanceProvider = 'OPENROUTESERVICE' | 'OSRM_FREE' | 'HAVERSINE_ESTIMATE' | 'GOOGLE_MAPS' | 'MAPBOX';
export type DistanceProviderMode = 'OPENROUTESERVICE' | 'OSRM' | 'AUTO';
export type TripDirection = 'ONE_WAY' | 'ROUND_TRIP';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodedLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface RouteDistanceResult {
  oneWayDistanceKm: number;
  providerUsed: DistanceProvider;
  /** True when ORS routing was unavailable and haversine × road factor was used. */
  approximateRoute?: boolean;
  pickupCoordinates: Coordinates;
  dropoffCoordinates: Coordinates;
  normalizedPickupLabel: string;
  normalizedDropoffLabel: string;
}

/** Geocode search provider tag returned to clients. */
export type { GeocodeProviderTag, GeocodeSearchResult, GeocodeSearchOptions } from './geocoding.ts';
export { searchLocations, reverseGeocodeLocation, GeocodingError } from './geocoding.ts';

// ─── Typed error ──────────────────────────────────────────────────────────────

export class DistanceError extends Error {
  code: 'NOT_CONFIGURED' | 'GEOCODE_FAILED' | 'ROUTE_FAILED' | 'PROVIDER_NOT_IMPLEMENTED';

  constructor(
    message: string,
    code: 'NOT_CONFIGURED' | 'GEOCODE_FAILED' | 'ROUTE_FAILED' | 'PROVIDER_NOT_IMPLEMENTED',
  ) {
    super(message);
    this.name = 'DistanceError';
    this.code = code;
  }
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function getProviderMode(): DistanceProviderMode {
  const p = (process.env.DISTANCE_PROVIDER ?? 'AUTO').toUpperCase();
  if (p === 'OPENROUTESERVICE' || p === 'OSRM' || p === 'AUTO') {
    return p as DistanceProviderMode;
  }
  return 'AUTO';
}

function getFallbackRoadFactor(): number {
  const n = Number(process.env.DISTANCE_FALLBACK_ROAD_FACTOR ?? '1.35');
  return Number.isFinite(n) && n > 0 ? n : 1.35;
}

function getOsrmBaseUrl(): string {
  return (process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(/\/$/, '');
}

function getProvider(): DistanceProvider {
  const p = (process.env.DISTANCE_PROVIDER ?? 'AUTO').toUpperCase();
  if (p === 'OPENROUTESERVICE' || p === 'OSRM' || p === 'AUTO') {
    return 'OPENROUTESERVICE';
  }
  if (p === 'GOOGLE_MAPS' || p === 'MAPBOX') {
    return p as DistanceProvider;
  }
  return 'OPENROUTESERVICE';
}

function getOrsApiKey(): string {
  const key = process.env.OPENROUTESERVICE_API_KEY;
  if (!key || !key.trim()) {
    throw new DistanceError(
      'Automatic distance calculation is not configured. Please contact the administrator.',
      'NOT_CONFIGURED',
    );
  }
  return key.trim();
}

/** Returns true if ORS is configured (key present). Used for status checks. */
export function isDistanceConfigured(): boolean {
  return !!(process.env.OPENROUTESERVICE_API_KEY?.trim());
}

// ─── OpenRouteService implementation ─────────────────────────────────────────

const ORS_BASE = 'https://api.openrouteservice.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/** Urban road distance ≈ straight-line × configured factor when routing unavailable. */
function getRoadDistanceFactor(): number {
  return getFallbackRoadFactor();
}

let lastOsrmCallAt = 0;
const OSRM_MIN_INTERVAL_MS = 1000;

async function rateLimitOsrm(): Promise<void> {
  const now = Date.now();
  const wait = OSRM_MIN_INTERVAL_MS - (now - lastOsrmCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastOsrmCallAt = Date.now();
}

export function approximateRoadKm(pickup: Coordinates, dropoff: Coordinates): number {
  return round2(haversineKm(pickup, dropoff) * getRoadDistanceFactor());
}

async function routeOsrm(
  pickup: { lat: number; lng: number; label: string },
  dropoff: { lat: number; lng: number; label: string },
): Promise<RouteDistanceResult> {
  await rateLimitOsrm();
  const base = getOsrmBaseUrl();
  const path = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const url = `${base}/route/v1/driving/${path}?overview=false`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new DistanceError('OSRM routing failed.', 'ROUTE_FAILED');
  }

  const json = (await res.json()) as { routes?: { distance?: number }[] };
  const distanceMeters = json.routes?.[0]?.distance;
  if (typeof distanceMeters !== 'number' || distanceMeters <= 0) {
    throw new DistanceError('OSRM returned no route.', 'ROUTE_FAILED');
  }

  return {
    oneWayDistanceKm: round2(distanceMeters / 1000),
    providerUsed: 'OSRM_FREE',
    approximateRoute: false,
    pickupCoordinates: { lat: pickup.lat, lng: pickup.lng },
    dropoffCoordinates: { lat: dropoff.lat, lng: dropoff.lng },
    normalizedPickupLabel: pickup.label,
    normalizedDropoffLabel: dropoff.label,
  };
}

function haversineRouteResult(
  pickup: { lat: number; lng: number; label: string },
  dropoff: { lat: number; lng: number; label: string },
): RouteDistanceResult {
  const oneWayDistanceKm = approximateRoadKm(pickup, dropoff);
  return {
    oneWayDistanceKm,
    providerUsed: 'HAVERSINE_ESTIMATE',
    approximateRoute: true,
    pickupCoordinates: { lat: pickup.lat, lng: pickup.lng },
    dropoffCoordinates: { lat: dropoff.lat, lng: dropoff.lng },
    normalizedPickupLabel: pickup.label,
    normalizedDropoffLabel: dropoff.label,
  };
}

export const APPROXIMATE_DISTANCE_WARNING =
  'Approximate distance. Final price may be reviewed by admin.';

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function resolveRouteFromCoords(
  pickup: { lat: number; lng: number; label: string },
  dropoff: { lat: number; lng: number; label: string },
): Promise<RouteDistanceResult> {
  const mode = getProviderMode();

  if (mode === 'OPENROUTESERVICE' || mode === 'AUTO') {
    if (isDistanceConfigured()) {
      try {
        const apiKey = getOrsApiKey();
        return await _orsDirections(apiKey, pickup, dropoff);
      } catch {
        if (mode === 'OPENROUTESERVICE') throw new DistanceError('Routing service unavailable.', 'ROUTE_FAILED');
      }
    } else if (mode === 'OPENROUTESERVICE') {
      throw new DistanceError(
        'Automatic distance calculation is not configured. Please contact the administrator.',
        'NOT_CONFIGURED',
      );
    }
  }

  if (mode === 'OSRM' || mode === 'AUTO') {
    try {
      return await routeOsrm(pickup, dropoff);
    } catch {
      if (mode === 'OSRM') {
        // fall through to haversine
      }
    }
  }

  const result = haversineRouteResult(pickup, dropoff);
  if (result.oneWayDistanceKm <= 0) {
    throw new DistanceError(
      'We could not calculate a route between these locations. Please select different pickup/drop-off points.',
      'ROUTE_FAILED',
    );
  }
  return result;
}

/**
 * Geocode a free-text address to coordinates using ORS Geocoding Search.
 * Returns the best match or throws DistanceError if nothing is found.
 *
 * @deprecated Prefer calculateRouteDistanceKmFromCoords when the UI has already
 *   provided precise coordinates via LocationPicker. This function is kept for
 *   backward-compatibility with legacy plain-text location inputs.
 */
export async function geocodeAddress(address: string): Promise<GeocodedLocation> {
  if (!address || !address.trim()) {
    throw new DistanceError('Address must not be empty', 'GEOCODE_FAILED');
  }

  const provider = getProvider();
  if (provider === 'GOOGLE_MAPS' || provider === 'MAPBOX') {
    throw new DistanceError(
      `Provider ${provider} is not implemented yet. Please configure OPENROUTESERVICE.`,
      'PROVIDER_NOT_IMPLEMENTED',
    );
  }

  const apiKey = getOrsApiKey();
  const url = new URL(`${ORS_BASE}/geocode/search`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('text', address.trim());
  url.searchParams.set('size', '1');
  url.searchParams.set('boundary.country', 'SA');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new DistanceError(
      'Could not reach geocoding service. Please try again.',
      'GEOCODE_FAILED',
    );
  }

  if (!res.ok) {
    throw new DistanceError(
      'Geocoding service returned an error. Please try again.',
      'GEOCODE_FAILED',
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new DistanceError('Geocoding service returned an invalid response.', 'GEOCODE_FAILED');
  }

  const features = (json as { features?: unknown[] }).features;
  if (!features || features.length === 0) {
    throw new DistanceError(
      `Could not find location: "${address}". Please enter a clearer address.`,
      'GEOCODE_FAILED',
    );
  }

  const feature = features[0] as {
    geometry: { coordinates: [number, number] };
    properties: { label?: string };
  };

  const [lng, lat] = feature.geometry.coordinates;
  const label = feature.properties.label ?? address.trim();

  return { lat, lng, label };
}

/**
 * Calculate road distance between two points using pre-selected coordinates.
 * Skips geocoding — use this when the client has already picked precise
 * coordinates via the LocationPicker autocomplete.
 */
export async function calculateRouteDistanceKmFromCoords(
  pickup: { lat: number; lng: number; label: string },
  dropoff: { lat: number; lng: number; label: string },
): Promise<RouteDistanceResult> {
  const provider = getProvider();
  if (provider === 'GOOGLE_MAPS' || provider === 'MAPBOX') {
    throw new DistanceError(
      `Provider ${provider} is not implemented yet. Please configure OPENROUTESERVICE or OSRM.`,
      'PROVIDER_NOT_IMPLEMENTED',
    );
  }

  return resolveRouteFromCoords(pickup, dropoff);
}

/**
 * Calculate the one-way road distance between two text addresses using ORS Directions.
 * Both addresses are geocoded first; then the driving-car route is requested.
 *
 * @deprecated Prefer calculateRouteDistanceKmFromCoords when coordinates are available.
 */
export async function calculateRouteDistanceKm(
  pickupLocation: string,
  dropoffLocation: string,
): Promise<RouteDistanceResult> {
  const provider = getProvider();

  if (provider === 'GOOGLE_MAPS' || provider === 'MAPBOX') {
    throw new DistanceError(
      `Provider ${provider} is not implemented yet. Please configure OPENROUTESERVICE.`,
      'PROVIDER_NOT_IMPLEMENTED',
    );
  }

  const apiKey = getOrsApiKey();

  // Geocode both addresses in parallel
  const [pickup, dropoff] = await Promise.all([
    geocodeAddress(pickupLocation),
    geocodeAddress(dropoffLocation),
  ]);

  return _orsDirections(apiKey, pickup, dropoff);
}

// ─── Shared ORS routing helper ─────────────────────────────────────────────────

async function _orsDirections(
  apiKey: string,
  pickup: { lat: number; lng: number; label: string },
  dropoff: { lat: number; lng: number; label: string },
): Promise<RouteDistanceResult> {
  const body = {
    coordinates: [
      [pickup.lng, pickup.lat],
      [dropoff.lng, dropoff.lat],
    ],
  };

  let routeRes: Response;
  try {
    routeRes = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new DistanceError(
      'Could not reach routing service. Please try again.',
      'ROUTE_FAILED',
    );
  }

  if (!routeRes.ok) {
    throw new DistanceError(
      'We could not calculate a route between these locations. Please select different pickup/drop-off points.',
      'ROUTE_FAILED',
    );
  }

  let routeJson: unknown;
  try {
    routeJson = await routeRes.json();
  } catch {
    throw new DistanceError('Routing service returned an invalid response.', 'ROUTE_FAILED');
  }

  const routes = (routeJson as { routes?: { summary?: { distance?: number; duration?: number } }[] }).routes;
  if (!routes || routes.length === 0 || typeof routes[0]?.summary?.distance !== 'number') {
    throw new DistanceError(
      'We could not calculate a route between these locations. Please select different pickup/drop-off points.',
      'ROUTE_FAILED',
    );
  }

  const distanceMeters = routes[0].summary!.distance!;
  const oneWayDistanceKm = round2(distanceMeters / 1000);

  return {
    oneWayDistanceKm,
    providerUsed: 'OPENROUTESERVICE',
    pickupCoordinates: { lat: pickup.lat, lng: pickup.lng },
    dropoffCoordinates: { lat: dropoff.lat, lng: dropoff.lng },
    normalizedPickupLabel: pickup.label,
    normalizedDropoffLabel: dropoff.label,
  };
}

export type RouteGeometrySource = 'road' | 'approximate';

export type RouteGeometryResult = {
  coordinates: [number, number][];
  source: RouteGeometrySource;
};

/** Fetch driving route geometry (lat/lng pairs) via ORS. Falls back to straight line. */
export async function getRouteGeometryFromCoords(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): Promise<RouteGeometryResult> {
  const fallback: RouteGeometryResult = {
    coordinates: [
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
    ],
    source: 'approximate',
  };

  if (!isDistanceConfigured()) return fallback;

  try {
    const apiKey = getOrsApiKey();
    const body = {
      coordinates: [
        [pickup.lng, pickup.lat],
        [dropoff.lng, dropoff.lat],
      ],
    };
    const routeRes = await fetch(`${ORS_BASE}/v2/directions/driving-car/geojson`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!routeRes.ok) return fallback;

    const geoJson = await routeRes.json() as {
      features?: { geometry?: { type?: string; coordinates?: [number, number][] } }[];
    };
    const coords = geoJson.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return fallback;

    return {
      coordinates: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
      source: 'road',
    };
  } catch {
    return fallback;
  }
}

export interface RouteDurationResult {
  durationMinutes: number;
  distanceMeters: number;
}

/** Driving duration between two points via ORS. Returns null if not configured or failed. */
export async function getDrivingDurationMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteDurationResult | null> {
  if (!isDistanceConfigured()) return null;
  try {
    const apiKey = getOrsApiKey();
    const body = {
      coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
    };
    const routeRes = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!routeRes.ok) return null;
    const routeJson = await routeRes.json() as { routes?: { summary?: { distance?: number; duration?: number } }[] };
    const summary = routeJson.routes?.[0]?.summary;
    if (!summary || typeof summary.duration !== 'number') return null;
    return {
      durationMinutes: summary.duration / 60,
      distanceMeters: summary.distance ?? 0,
    };
  } catch {
    return null;
  }
}

/** Haversine + average speed fallback ETA in minutes. */
export function estimateDurationMinutesFallback(
  distanceMeters: number,
  speedKmh: number,
): number {
  if (distanceMeters <= 0 || speedKmh <= 0) return 0;
  return (distanceMeters / 1000) / speedKmh * 60;
}

/**
 * Calculate chargeable distance based on trip direction.
 *  - ONE_WAY:   chargeableKm = oneWayDistanceKm
 *  - ROUND_TRIP: chargeableKm = oneWayDistanceKm * 2
 */
export function calculateChargeableDistanceKm(
  oneWayDistanceKm: number,
  tripDirection: TripDirection,
): number {
  if (oneWayDistanceKm <= 0) return 0;
  return round2(tripDirection === 'ROUND_TRIP' ? oneWayDistanceKm * 2 : oneWayDistanceKm);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
