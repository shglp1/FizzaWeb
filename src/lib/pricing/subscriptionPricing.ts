export interface PricingConfig {
  pricePerKmSar: number;
  extraRiderSameDropoffMultiplier: number;
}

export interface SubscriptionPriceBreakdown {
  packagePriceSar: number;
  addOnsPriceSar: number;
  distancePriceSar: number;
  extraRidersPriceSar: number;
  primaryFinalSar: number;
  finalPriceSar: number;
  pricePerKmSar: number;
  extraRiderMultiplier: number;
}

const DEFAULT_PRICE_PER_KM = 2.0;
const DEFAULT_EXTRA_RIDER_MULTIPLIER = 0.5;

export async function getPricingConfig(): Promise<PricingConfig> {
  const { prisma } = await import('@/lib/prisma');
  const [kmRow, multiplierRow] = await Promise.all([
    prisma.systemConfiguration.findUnique({ where: { key: 'pricePerKmSar' } }),
    prisma.systemConfiguration.findUnique({ where: { key: 'extraRiderSameDropoffMultiplier' } }),
  ]);

  return {
    pricePerKmSar:
      typeof kmRow?.value === 'number'
        ? kmRow.value
        : DEFAULT_PRICE_PER_KM,
    extraRiderSameDropoffMultiplier:
      typeof multiplierRow?.value === 'number'
        ? multiplierRow.value
        : DEFAULT_EXTRA_RIDER_MULTIPLIER,
  };
}

export function calculateDistanceCharge(distanceKm: number, pricePerKm: number): number {
  if (distanceKm <= 0 || pricePerKm <= 0) return 0;
  return round2(distanceKm * pricePerKm);
}

export function calculateExtraRiderCharge(
  primaryFinalPrice: number,
  multiplier: number,
): number {
  return round2(primaryFinalPrice * multiplier);
}

export function calculateSubscriptionQuote(
  packagePriceSar: number,
  addOnsPriceSar: number,
  estimatedDistanceKm: number,
  extraRiderCount: number,
  config: PricingConfig,
): SubscriptionPriceBreakdown {
  const distancePriceSar = calculateDistanceCharge(estimatedDistanceKm, config.pricePerKmSar);
  const primaryFinalSar = round2(packagePriceSar + addOnsPriceSar + distancePriceSar);
  const perExtraRiderSar = calculateExtraRiderCharge(primaryFinalSar, config.extraRiderSameDropoffMultiplier);
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
