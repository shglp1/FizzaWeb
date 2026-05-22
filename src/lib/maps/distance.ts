/**
 * Server-side distance calculation utility.
 *
 * Uses OpenRouteService (ORS) by default. API key is read from environment
 * variables and is NEVER exposed to the client. All routing calls happen
 * exclusively on the server.
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

// ─── OpenRouteService implementation ─────────────────────────────────────────

const ORS_BASE = 'https://api.openrouteservice.org';

/**
 * Geocode a free-text address to coordinates using ORS Geocoding Search.
 * Returns the best match or throws DistanceError if nothing is found.
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
      // Next.js server fetch — do not cache (prices/routes must be fresh)
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
 * Calculate the one-way road distance between two addresses using ORS Directions.
 * Both addresses are geocoded first; then the driving-car route is requested.
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

  // ORS Directions API — POST /v2/directions/driving-car
  // Coordinates must be [lng, lat] order for ORS
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
      'Could not calculate route distance between pickup and drop-off. Please check the addresses.',
      'ROUTE_FAILED',
    );
  }

  let routeJson: unknown;
  try {
    routeJson = await routeRes.json();
  } catch {
    throw new DistanceError('Routing service returned an invalid response.', 'ROUTE_FAILED');
  }

  // ORS response: { routes: [{ summary: { distance: <meters> } }] }
  const routes = (routeJson as { routes?: { summary?: { distance?: number } }[] }).routes;
  if (!routes || routes.length === 0 || typeof routes[0]?.summary?.distance !== 'number') {
    throw new DistanceError(
      'Could not calculate route distance between pickup and drop-off.',
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
