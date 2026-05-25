import 'server-only';
import type { LoyaltyRedemptionConfig } from '@/lib/loyalty/loyaltyRedemptionRules';

const DEFAULTS = {
  loyaltyRedemptionEnabled: false,
  loyaltyRedemptionPointsPerSar: 10,
  loyaltyRedemptionMaxPercentOfOrder: 20,
  loyaltyMinimumPointsToRedeem: 100,
};

export async function getLoyaltyRedemptionConfig(): Promise<LoyaltyRedemptionConfig> {
  const { prisma } = await import('@/lib/prisma');
  const keys = [
    'loyaltyRedemptionEnabled',
    'loyaltyRedemptionPointsPerSar',
    'loyaltyRedemptionMaxPercentOfOrder',
    'loyaltyMinimumPointsToRedeem',
  ] as const;

  const rows = await prisma.systemConfiguration.findMany({
    where: { key: { in: [...keys] } },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const enabled = map.has('loyaltyRedemptionEnabled')
    ? Boolean(map.get('loyaltyRedemptionEnabled'))
    : DEFAULTS.loyaltyRedemptionEnabled;

  const pointsPerSar =
    typeof map.get('loyaltyRedemptionPointsPerSar') === 'number'
      ? Number(map.get('loyaltyRedemptionPointsPerSar'))
      : DEFAULTS.loyaltyRedemptionPointsPerSar;

  const maxPercentOfOrder =
    typeof map.get('loyaltyRedemptionMaxPercentOfOrder') === 'number'
      ? Number(map.get('loyaltyRedemptionMaxPercentOfOrder'))
      : DEFAULTS.loyaltyRedemptionMaxPercentOfOrder;

  const minimumPointsToRedeem =
    typeof map.get('loyaltyMinimumPointsToRedeem') === 'number'
      ? Number(map.get('loyaltyMinimumPointsToRedeem'))
      : DEFAULTS.loyaltyMinimumPointsToRedeem;

  return {
    enabled,
    pointsPerSar: pointsPerSar > 0 ? pointsPerSar : DEFAULTS.loyaltyRedemptionPointsPerSar,
    maxPercentOfOrder: maxPercentOfOrder > 0 ? maxPercentOfOrder : DEFAULTS.loyaltyRedemptionMaxPercentOfOrder,
    minimumPointsToRedeem:
      minimumPointsToRedeem > 0 ? minimumPointsToRedeem : DEFAULTS.loyaltyMinimumPointsToRedeem,
  };
}
