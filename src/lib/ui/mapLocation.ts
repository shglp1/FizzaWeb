/**
 * Map location picker helpers (pure, testable).
 */

export type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function mapGeoErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Location permission was denied. You can search for your address manually.';
    case 2:
      return 'Could not determine your location. Check device settings or search manually.';
    case 3:
      return 'Location request timed out. Please try again or search manually.';
    default:
      return 'Could not access your location. Please search manually.';
  }
}

export function requiresConfirmedPin(
  hasText: boolean,
  hasLatLng: boolean,
): boolean {
  return hasText && !hasLatLng;
}
