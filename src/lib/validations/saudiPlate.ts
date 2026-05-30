/**
 * Saudi Arabia plate number validation (simplified formats).
 * Accepts common patterns: Latin digits+letters and Arabic variants with spaces/dashes.
 */

const LATIN_PLATE = /^[0-9]{1,4}\s?[A-Za-z]{1,3}\s?[0-9]{1,4}$/;
const COMPACT_LATIN = /^[A-Za-z0-9]{3,10}$/;

export function normalizeSaudiPlate(plate: string): string {
  return plate.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function isValidSaudiPlate(plate: string): boolean {
  const normalized = normalizeSaudiPlate(plate);
  if (normalized.length < 3 || normalized.length > 12) return false;
  return LATIN_PLATE.test(normalized) || COMPACT_LATIN.test(normalized.replace(/\s/g, ''));
}

export function saudiPlateError(plate: string): string | null {
  if (!plate.trim()) return 'Plate number is required';
  if (!isValidSaudiPlate(plate)) {
    return 'Enter a valid Saudi plate (e.g. 1234 ABC 12)';
  }
  return null;
}
