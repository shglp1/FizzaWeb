/**
 * Server-side subscription pricing calculations.
 *
 * Formula (Task 8.6):
 *   oneWayDistanceKm  = road distance from OpenRouteService
 *   chargeableKm      = ONE_WAY: oneWayDistanceKm  |  ROUND_TRIP: oneWayDistanceKm × 2
 *   distanceChargeSar = chargeableKm × pricePerKmSar
 *   primaryFinalSar   = packagePriceSar + addOnsPriceSar + distanceChargeSar
 *   extraRiderCharge  = numExtraRiders × (primaryFinalSar × extraRiderMultiplier)
 *   finalPriceSar     = primaryFinalSar + extraRiderCharge
 *
 * The caller is responsible for providing chargeableDistanceKm (already
 * doubled for ROUND_TRIP). This keeps the pure functions testable without
 * needing any I/O.
 */

export interface PricingConfig {
  pricePerKmSar: number;
  extraRiderSameDropoffMultiplier: number;
}

export interface SubscriptionPriceBreakdown {
  packagePriceSar: number;
  addOnsPriceSar: number;
  /** chargeableDistanceKm × pricePerKmSar */
  distancePriceSar: number;
  extraRidersPriceSar: number;
  primaryFinalSar: number;
  finalPriceSar: number;
  pricePerKmSar: number;
  extraRiderMultiplier: number;
}

const DEFAULT_PRICE_PER_KM = 2.0;
const DEFAULT_EXTRA_RIDER_MULTIPLIER = 0.5;

/** Fetch pricing config from SystemConfiguration table (server-side only). */
export async function getPricingConfig(): Promise<PricingConfig> {
  const { prisma } = await import('@/lib/prisma');
  const [kmRow, multiplierRow] = await Promise.all([
    prisma.systemConfiguration.findUnique({ where: { key: 'pricePerKmSar' } }),
    prisma.systemConfiguration.findUnique({ where: { key: 'extraRiderSameDropoffMultiplier' } }),
  ]);

  return {
    pricePerKmSar:
      typeof kmRow?.value === 'number' ? kmRow.value : DEFAULT_PRICE_PER_KM,
    extraRiderSameDropoffMultiplier:
      typeof multiplierRow?.value === 'number'
        ? multiplierRow.value
        : DEFAULT_EXTRA_RIDER_MULTIPLIER,
  };
}

/**
 * Calculate the SAR charge for a given distance.
 * Returns 0 if distance or rate is zero/negative.
 */
export function calculateDistanceCharge(distanceKm: number, pricePerKm: number): number {
  if (distanceKm <= 0 || pricePerKm <= 0) return 0;
  return round2(distanceKm * pricePerKm);
}

/**
 * Calculate the extra-rider charge for ONE additional rider.
 * Caller multiplies by number of extra riders.
 */
export function calculateExtraRiderCharge(
  primaryFinalPrice: number,
  multiplier: number,
): number {
  return round2(primaryFinalPrice * multiplier);
}

/**
 * Calculate the full subscription price breakdown.
 *
 * @param packagePriceSar    - SAR price of the selected package
 * @param addOnsPriceSar     - SAR total of all selected add-ons
 * @param chargeableDistanceKm - Already-adjusted distance (2× for ROUND_TRIP)
 * @param extraRiderCount    - Number of riders beyond the primary (≥0)
 * @param config             - Pricing config (rate per km, extra-rider multiplier)
 */
export function calculateSubscriptionQuote(
  packagePriceSar: number,
  addOnsPriceSar: number,
  chargeableDistanceKm: number,
  extraRiderCount: number,
  config: PricingConfig,
): SubscriptionPriceBreakdown {
  const distancePriceSar = calculateDistanceCharge(chargeableDistanceKm, config.pricePerKmSar);
  const primaryFinalSar = round2(packagePriceSar + addOnsPriceSar + distancePriceSar);
  const perExtraRiderSar = calculateExtraRiderCharge(
    primaryFinalSar,
    config.extraRiderSameDropoffMultiplier,
  );
  const extraRidersPriceSar = round2(Math.max(0, extraRiderCount) * perExtraRiderSar);
  const finalPriceSar = round2(primaryFinalSar + extraRidersPriceSar);

  return {
    packagePriceSar: round2(packagePriceSar),
    addOnsPriceSar: round2(addOnsPriceSar),
    distancePriceSar,
    extraRidersPriceSar,
    primaryFinalSar,
    finalPriceSar,
    pricePerKmSar: config.pricePerKmSar,
    extraRiderMultiplier: config.extraRiderSameDropoffMultiplier,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
