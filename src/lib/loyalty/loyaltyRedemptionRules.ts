/** Pure loyalty redemption rules — testable without DB. */

export type LoyaltyRedemptionConfig = {
  enabled: boolean;
  /** Points required for SAR 1 discount (e.g. 10 = 10 points → SAR 1). */
  pointsPerSar: number;
  maxPercentOfOrder: number;
  minimumPointsToRedeem: number;
};

export type LoyaltyRedemptionResult =
  | {
      ok: true;
      pointsUsed: number;
      discountSar: number;
      priceAfterPromoSar: number;
      finalPriceSar: number;
      remainingPoints: number;
      maxDiscountSar: number;
    }
  | { ok: false; message: string };

export function pointsToSarDiscount(points: number, pointsPerSar: number): number {
  if (points <= 0 || pointsPerSar <= 0) return 0;
  return round2(points / pointsPerSar);
}

export function sarDiscountToPoints(discountSar: number, pointsPerSar: number): number {
  if (discountSar <= 0 || pointsPerSar <= 0) return 0;
  return Math.floor(discountSar * pointsPerSar);
}

/** Compute max redeemable points given caps. */
export function maxRedeemablePoints(
  subtotalSar: number,
  priceAfterPromoSar: number,
  availablePoints: number,
  config: LoyaltyRedemptionConfig,
): number {
  if (!config.enabled || availablePoints < config.minimumPointsToRedeem) return 0;
  const maxDiscountSar = round2(subtotalSar * (config.maxPercentOfOrder / 100));
  const cappedDiscount = Math.min(maxDiscountSar, priceAfterPromoSar);
  const maxByCap = sarDiscountToPoints(cappedDiscount, config.pointsPerSar);
  return Math.min(availablePoints, maxByCap);
}

export function calculateLoyaltyRedemption(opts: {
  subtotalSar: number;
  promoDiscountSar: number;
  pointsToRedeem: number;
  availablePoints: number;
  config: LoyaltyRedemptionConfig;
}): LoyaltyRedemptionResult {
  const { subtotalSar, promoDiscountSar, pointsToRedeem, availablePoints, config } = opts;
  const priceAfterPromoSar = round2(Math.max(0, subtotalSar - promoDiscountSar));

  if (pointsToRedeem <= 0) {
    return {
      ok: true,
      pointsUsed: 0,
      discountSar: 0,
      priceAfterPromoSar,
      finalPriceSar: priceAfterPromoSar,
      remainingPoints: availablePoints,
      maxDiscountSar: 0,
    };
  }

  if (!config.enabled) {
    return { ok: false, message: 'Loyalty redemption is not available yet.' };
  }

  if (availablePoints < config.minimumPointsToRedeem) {
    return {
      ok: false,
      message: `You need at least ${config.minimumPointsToRedeem} points to redeem.`,
    };
  }

  if (pointsToRedeem < config.minimumPointsToRedeem) {
    return {
      ok: false,
      message: `Minimum redemption is ${config.minimumPointsToRedeem} points.`,
    };
  }

  if (pointsToRedeem > availablePoints) {
    return { ok: false, message: 'You do not have enough loyalty points.' };
  }

  const maxDiscountSar = round2(subtotalSar * (config.maxPercentOfOrder / 100));
  let discountSar = pointsToSarDiscount(pointsToRedeem, config.pointsPerSar);
  discountSar = Math.min(discountSar, maxDiscountSar, priceAfterPromoSar);
  const pointsUsed = sarDiscountToPoints(discountSar, config.pointsPerSar);

  if (pointsUsed < config.minimumPointsToRedeem) {
    return {
      ok: false,
      message: `Redemption amount is below the minimum of ${config.minimumPointsToRedeem} points.`,
    };
  }

  const finalPriceSar = round2(Math.max(0, priceAfterPromoSar - discountSar));

  return {
    ok: true,
    pointsUsed,
    discountSar,
    priceAfterPromoSar,
    finalPriceSar,
    remainingPoints: availablePoints - pointsUsed,
    maxDiscountSar,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
