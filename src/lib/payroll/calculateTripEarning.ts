/** Pure trip pay calculation — billable km × rate, minus platform fee. */

export type TripEarningInput = {
  billableKm: number;
  ratePerKmSar: number;
  platformFeePercent: number;
};

export type TripEarningResult = {
  grossSar: number;
  platformFeeSar: number;
  netSar: number;
};

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundKm(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function calculateTripEarning(input: TripEarningInput): TripEarningResult {
  const grossSar = roundMoney(input.billableKm * input.ratePerKmSar);
  const platformFeeSar = roundMoney(grossSar * (input.platformFeePercent / 100));
  const netSar = roundMoney(grossSar - platformFeeSar);
  return { grossSar, platformFeeSar, netSar };
}

export function calculatePeriodNetPay(input: {
  tripNetSar: number;
  deductionsSar: number;
  bonusesSar: number;
}): number {
  return roundMoney(input.tripNetSar - input.deductionsSar + input.bonusesSar);
}
