import { roundMoney } from '../payroll/calculateTripEarning.ts';

export type SubscriptionMarginInput = {
  /** Parent-paid subscription amount (final price after discounts). */
  subscriptionRevenueSar: number;
  totalChargeableDistanceKm: number;
  driverRatePerKmSar: number;
  platformFeePercent: number;
  estimatedDeductionsSar?: number;
  estimatedBonusesSar?: number;
};

export type SubscriptionMarginResult = {
  estimatedDriverGrossSar: number;
  estimatedPlatformFeeSar: number;
  estimatedDriverPayoutSar: number;
  estimatedSubscriptionMarginSar: number;
};

/** Estimated subscription margin — admin only; does not affect billing or payroll. */
export function calculateSubscriptionMargin(input: SubscriptionMarginInput): SubscriptionMarginResult {
  const deductions = input.estimatedDeductionsSar ?? 0;
  const bonuses = input.estimatedBonusesSar ?? 0;
  const km = Math.max(0, Number(input.totalChargeableDistanceKm) || 0);
  const rate = Math.max(0, Number(input.driverRatePerKmSar) || 0);
  const feePct = Math.min(100, Math.max(0, Number(input.platformFeePercent) || 0));

  const estimatedDriverGrossSar = roundMoney(km * rate);
  const estimatedPlatformFeeSar = roundMoney(estimatedDriverGrossSar * (feePct / 100));
  const estimatedDriverPayoutSar = roundMoney(
    estimatedDriverGrossSar - estimatedPlatformFeeSar - deductions + bonuses,
  );
  const estimatedSubscriptionMarginSar = roundMoney(
    Number(input.subscriptionRevenueSar) - estimatedDriverPayoutSar,
  );

  return {
    estimatedDriverGrossSar,
    estimatedPlatformFeeSar,
    estimatedDriverPayoutSar,
    estimatedSubscriptionMarginSar,
  };
}

/** True when driver pay per km exceeds parent distance charge per km. */
export function isDriverRateAboveParentDistanceRate(
  driverRatePerKmSar: number,
  parentDistanceRatePerKmSar: number,
): boolean {
  return driverRatePerKmSar > parentDistanceRatePerKmSar;
}
