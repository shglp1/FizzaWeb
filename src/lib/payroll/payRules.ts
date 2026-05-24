import { prisma } from '../prisma.ts';

export const DEFAULT_DRIVER_PAY_RATE_PER_KM = 1.5;
export const DEFAULT_DRIVER_PLATFORM_FEE_PERCENT = 15;

export type PayRules = {
  ratePerKmSar: number;
  platformFeePercent: number;
};

export type DriverPayProfileOverrides = {
  ratePerKmSar: number | null;
  platformFeePercent: number | null;
} | null;

export async function loadGlobalPayRules(): Promise<PayRules> {
  const rows = await prisma.systemConfiguration.findMany({
    where: { key: { in: ['driverPayRatePerKmSar', 'driverPlatformFeePercent'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, String(r.value)]));
  const rate = parseFloat(map.driverPayRatePerKmSar ?? '');
  const fee = parseFloat(map.driverPlatformFeePercent ?? '');
  return {
    ratePerKmSar: Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_DRIVER_PAY_RATE_PER_KM,
    platformFeePercent: Number.isFinite(fee) && fee >= 0 && fee <= 100
      ? fee
      : DEFAULT_DRIVER_PLATFORM_FEE_PERCENT,
  };
}

export function resolveDriverPayRules(
  global: PayRules,
  profile: DriverPayProfileOverrides,
): PayRules {
  return {
    ratePerKmSar: profile?.ratePerKmSar != null ? profile.ratePerKmSar : global.ratePerKmSar,
    platformFeePercent: profile?.platformFeePercent != null
      ? profile.platformFeePercent
      : global.platformFeePercent,
  };
}
