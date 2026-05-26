import { roundMoney } from './calculateTripEarning.ts';

export type PayrollLineEconomicsInput = {
  grossSar: number | string;
  platformFeeSar: number | string;
  tripNetSar: number | string;
  deductionsSar: number | string;
  bonusesSar: number | string;
  netPaySar: number | string;
  status: string;
};

export type PeriodEconomics = {
  gross: number;
  platformFee: number;
  driverNet: number;
  deductions: number;
  bonuses: number;
  netPay: number;
  paidPlatformFee: number;
  paidDeductions: number;
  paidBonuses: number;
  paidNet: number;
};

export function aggregatePeriodEconomics(lines: PayrollLineEconomicsInput[]): PeriodEconomics {
  return lines.reduce(
    (acc, l) => {
      const isPaid = l.status === 'PAID';
      const deductions = Number(l.deductionsSar);
      const bonuses = Number(l.bonusesSar);
      return {
        gross: acc.gross + Number(l.grossSar),
        platformFee: acc.platformFee + Number(l.platformFeeSar),
        driverNet: acc.driverNet + Number(l.tripNetSar),
        deductions: acc.deductions + deductions,
        bonuses: acc.bonuses + bonuses,
        netPay: acc.netPay + Number(l.netPaySar),
        paidPlatformFee: acc.paidPlatformFee + (isPaid ? Number(l.platformFeeSar) : 0),
        paidDeductions: acc.paidDeductions + (isPaid ? deductions : 0),
        paidBonuses: acc.paidBonuses + (isPaid ? bonuses : 0),
        paidNet: acc.paidNet + (isPaid ? Number(l.netPaySar) : 0),
      };
    },
    {
      gross: 0,
      platformFee: 0,
      driverNet: 0,
      deductions: 0,
      bonuses: 0,
      netPay: 0,
      paidPlatformFee: 0,
      paidDeductions: 0,
      paidBonuses: 0,
      paidNet: 0,
    },
  );
}

/** Fizza keeps: platform fee + admin deductions − bonuses (driver-side). */
export function fizzaRetentionFromDrivers(e: PeriodEconomics): number {
  return roundMoney(e.platformFee + e.deductions - e.bonuses);
}

export function fizzaRetentionFromDriversPaid(e: PeriodEconomics): number {
  return roundMoney(e.paidPlatformFee + e.paidDeductions - e.paidBonuses);
}

/** Driver-side retention from paid payroll lines: platform fee + deductions − bonuses. */
export function driverRetentionFromPaid(input: {
  platformFeePaidSar: number;
  deductionsPaidSar: number;
  bonusesPaidSar: number;
}): number {
  return roundMoney(
    input.platformFeePaidSar + input.deductionsPaidSar - input.bonusesPaidSar,
  );
}

export function combinedPlatformRevenue(input: {
  parentPaymentsSar: number;
  driverPlatformFeePaidSar: number;
  driverDeductionsPaidSar: number;
  driverBonusesPaidSar: number;
}): number {
  return roundMoney(
    input.parentPaymentsSar
    + input.driverPlatformFeePaidSar
    + input.driverDeductionsPaidSar
    - input.driverBonusesPaidSar,
  );
}

/** Total recognized revenue = paid parent transactions + settled driver-side retention. */
export function totalRecognizedRevenue(input: {
  paidParentRevenueSar: number;
  driverRetentionPaidSar: number;
}): number {
  return roundMoney(input.paidParentRevenueSar + input.driverRetentionPaidSar);
}

/**
 * Estimated gross margin before operating costs.
 * paidParentRevenue + driverRetention − driverPayoutsCompleted
 */
export function estimatedGrossMargin(input: {
  paidParentRevenueSar: number;
  driverRetentionPaidSar: number;
  driverPayoutsCompletedSar: number;
}): number {
  return roundMoney(
    input.paidParentRevenueSar
    + input.driverRetentionPaidSar
    - input.driverPayoutsCompletedSar,
  );
}

export function estimatedGrossMarginPercent(
  paidParentRevenueSar: number,
  estimatedGrossMarginSar: number,
): number {
  if (paidParentRevenueSar <= 0) return 0;
  return roundMoney((estimatedGrossMarginSar / paidParentRevenueSar) * 100);
}

/** Driver-side retention from trip gross: platformFee + deductions − bonuses. */
export function driverRetentionFromLine(input: {
  platformFeeSar: number;
  deductionsSar: number;
  bonusesSar: number;
}): number {
  return roundMoney(input.platformFeeSar + input.deductionsSar - input.bonusesSar);
}
