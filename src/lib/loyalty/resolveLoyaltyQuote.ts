import 'server-only';
import { getLoyaltyRedemptionConfig } from '@/lib/loyalty/getLoyaltyConfig';
import {
  calculateLoyaltyRedemption,
  maxRedeemablePoints,
  type LoyaltyRedemptionConfig,
} from '@/lib/loyalty/loyaltyRedemptionRules';

export type LoyaltyQuoteInfo = {
  availablePoints: number;
  redemptionEnabled: boolean;
  pointsUsed: number;
  discountSar: number;
  remainingPoints: number;
  maxDiscountSar: number;
  maxRedeemablePoints: number;
  minimumPointsToRedeem: number;
  pointsPerSar: number;
};

export async function resolveLoyaltyRedemptionForQuote(opts: {
  userId: string;
  subtotalSar: number;
  promoDiscountSar: number;
  pointsToRedeem: number;
}): Promise<
  | { ok: true; loyaltyDiscountSar: number; pointsUsed: number; loyalty: LoyaltyQuoteInfo; finalPriceSar: number }
  | { ok: false; message: string }
> {
  const { prisma } = await import('@/lib/prisma');
  const config = await getLoyaltyRedemptionConfig();
  const account = await prisma.loyaltyAccount.findUnique({
    where: { userId: opts.userId },
    select: { pointsBalance: true },
  });
  const availablePoints = account?.pointsBalance ?? 0;

  const maxPts = maxRedeemablePoints(
    opts.subtotalSar,
    Math.max(0, opts.subtotalSar - opts.promoDiscountSar),
    availablePoints,
    config,
  );

  const baseInfo = (cfg: LoyaltyRedemptionConfig): LoyaltyQuoteInfo => ({
    availablePoints,
    redemptionEnabled: cfg.enabled,
    pointsUsed: 0,
    discountSar: 0,
    remainingPoints: availablePoints,
    maxDiscountSar: round2(opts.subtotalSar * (cfg.maxPercentOfOrder / 100)),
    maxRedeemablePoints: maxPts,
    minimumPointsToRedeem: cfg.minimumPointsToRedeem,
    pointsPerSar: cfg.pointsPerSar,
  });

  if (opts.pointsToRedeem <= 0) {
    const priceAfterPromo = round2(Math.max(0, opts.subtotalSar - opts.promoDiscountSar));
    return {
      ok: true,
      loyaltyDiscountSar: 0,
      pointsUsed: 0,
      loyalty: baseInfo(config),
      finalPriceSar: priceAfterPromo,
    };
  }

  const result = calculateLoyaltyRedemption({
    subtotalSar: opts.subtotalSar,
    promoDiscountSar: opts.promoDiscountSar,
    pointsToRedeem: opts.pointsToRedeem,
    availablePoints,
    config,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return {
    ok: true,
    loyaltyDiscountSar: result.discountSar,
    pointsUsed: result.pointsUsed,
    loyalty: {
      ...baseInfo(config),
      pointsUsed: result.pointsUsed,
      discountSar: result.discountSar,
      remainingPoints: result.remainingPoints,
    },
    finalPriceSar: result.finalPriceSar,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
