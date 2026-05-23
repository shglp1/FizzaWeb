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

export type DistanceProvider = 'OPENROUTESERVICE' | 'GOOGLE_MAPS' | 'MAPBOX';
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
  pickupCoordinates: Coordinates;
  dropoffCoordinates: Coordinates;
  normalizedPickupLabel: string;
  normalizedDropoffLabel: string;
}

/** Normalized result from geocode search — returned by /api/maps/geocode. */
export interface GeocodeSearchResult {
  label: string;
  latitude: number;
  longitude: number;
  provider: 'openrouteservice';
  providerPlaceId?: string;
}

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

function getProvider(): DistanceProvider {
  const p = (process.env.DISTANCE_PROVIDER ?? 'OPENROUTESERVICE').toUpperCase();
  if (p === 'OPENROUTESERVICE' || p === 'GOOGLE_MAPS' || p === 'MAPBOX') {
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

/**
 * Search for locations using ORS Geocoding Search. Returns up to 5 suggestions.
 * Used exclusively by the /api/maps/geocode server route.
 */
export async function searchLocations(query: string): Promise<GeocodeSearchResult[]> {
  if (!query || query.trim().length < 3) return [];

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
  url.searchParams.set('text', query.trim());
  url.searchParams.set('size', '5');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new DistanceError('Could not reach geocoding service. Please try again.', 'GEOCODE_FAILED');
  }

  if (!res.ok) {
    throw new DistanceError('Geocoding service returned an error. Please try again.', 'GEOCODE_FAILED');
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new DistanceError('Geocoding service returned an invalid response.', 'GEOCODE_FAILED');
  }

  const features = (json as { features?: unknown[] }).features ?? [];
  return features.map((f) => {
    const feature = f as {
      geometry: { coordinates: [number, number] };
      properties: { label?: string; id?: string; name?: string };
    };
    const [lng, lat] = feature.geometry.coordinates;
    return {
      label: feature.properties.label ?? feature.properties.name ?? 'Unknown location',
      latitude: lat,
      longitude: lng,
      provider: 'openrouteservice' as const,
      providerPlaceId: feature.properties.id ?? undefined,
    };
  });
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
      `Provider ${provider} is not implemented yet. Please configure OPENROUTESERVICE.`,
      'PROVIDER_NOT_IMPLEMENTED',
    );
  }

  const apiKey = getOrsApiKey();
  return _orsDirections(apiKey, pickup, dropoff);
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
