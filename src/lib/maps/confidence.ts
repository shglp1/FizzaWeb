/** Location confidence levels for geocode and subscription review workflow. */

export type LocationConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type LocationSourceTag = 'LOCAL' | 'ORS' | 'NOMINATIM' | 'MANUAL';

export function confidenceForLocal(isVerified: boolean): LocationConfidenceLevel {
  return isVerified ? 'HIGH' : 'MEDIUM';
}

export function confidenceForExternal(
  source: 'ORS' | 'NOMINATIM',
  options?: { hasLandmark?: boolean; hasNeighborhood?: boolean },
): LocationConfidenceLevel {
  if (source === 'ORS' && (options?.hasLandmark || options?.hasNeighborhood)) return 'MEDIUM';
  if (source === 'NOMINATIM' && options?.hasLandmark) return 'MEDIUM';
  return 'LOW';
}

export function confidenceForManual(): LocationConfidenceLevel {
  return 'LOW';
}

export function needsAdminReview(
  confidence: LocationConfidenceLevel,
  source: LocationSourceTag,
  isVerifiedPlace?: boolean,
): boolean {
  if (isVerifiedPlace && source === 'LOCAL' && confidence === 'HIGH') return false;
  if (confidence === 'LOW') return true;
  if (source === 'NOMINATIM' || source === 'MANUAL') return true;
  if (source === 'LOCAL' && !isVerifiedPlace) return true;
  return false;
}

export function confidenceLabel(level: LocationConfidenceLevel): string {
  switch (level) {
    case 'HIGH':
      return 'High';
    case 'MEDIUM':
      return 'Medium';
    case 'LOW':
      return 'Low';
  }
}
