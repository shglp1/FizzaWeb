/**
 * Google Maps URL helpers (Task 11D).
 *
 * These functions generate deep-link URLs that open the Google Maps app
 * (or website) and navigate to the specified coordinates or address.
 *
 * All functions are pure and safe to call in both server and client contexts.
 */

/**
 * Build a Google Maps directions URL from origin to destination.
 * Accepts either "lat,lng" strings or plain address strings.
 *
 * @param origin      - Pickup location (address label or "lat,lng").
 * @param destination - Dropoff location (address label or "lat,lng").
 * @returns            Google Maps directions URL.
 */
export function buildGoogleMapsDirectionsUrl(origin: string, destination: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Build a Google Maps directions URL from coordinate pairs.
 *
 * @param pickup  - { lat, lng } of the pickup point.
 * @param dropoff - { lat, lng } of the dropoff point.
 */
export function buildGoogleMapsDirectionsFromCoords(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): string {
  const origin = `${pickup.lat},${pickup.lng}`;
  const destination = `${dropoff.lat},${dropoff.lng}`;
  return buildGoogleMapsDirectionsUrl(origin, destination);
}

/**
 * Build a Google Maps "place" URL that opens the map centred on coordinates.
 *
 * @param lat   - Latitude.
 * @param lng   - Longitude.
 * @param label - Optional place name shown in the URL (for human readability only).
 */
export function buildGoogleMapsPlaceUrl(lat: number, lng: number, label?: string): string {
  const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${lat},${lng}`;
}

/**
 * Produce the best available Google Maps directions link for a trip.
 * Prefers coordinates; falls back to address strings.
 *
 * @param trip - Object with location strings and optional coordinate fields.
 */
export function tripToGoogleMapsUrl(trip: {
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
}): string {
  if (
    trip.pickupLat != null &&
    trip.pickupLng != null &&
    trip.dropoffLat != null &&
    trip.dropoffLng != null
  ) {
    return buildGoogleMapsDirectionsFromCoords(
      { lat: trip.pickupLat, lng: trip.pickupLng },
      { lat: trip.dropoffLat, lng: trip.dropoffLng },
    );
  }
  return buildGoogleMapsDirectionsUrl(trip.pickupLocation, trip.dropoffLocation);
}
