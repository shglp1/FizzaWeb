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

/** User-facing label for distance provider in quotes and tracking. */
export function mapDistanceProviderLabel(provider: string, approximate?: boolean): string {
  if (approximate) {
    return 'Approximate distance (straight-line estimate × road factor)';
  }
  return provider.replace(/_/g, ' ').toLowerCase();
}

/** Safe display for Arabic/English geocode labels (no HTML injection). */
export function sanitizeMapLabel(label: string, maxLen = 120): string {
  const trimmed = label.replace(/[<>]/g, '').trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}
