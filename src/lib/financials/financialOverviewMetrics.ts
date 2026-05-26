import {
  combinedPlatformRevenue,
  driverRetentionFromPaid,
  estimatedGrossMargin,
  estimatedGrossMarginPercent,
} from '../payroll/platformEconomics.ts';

export type FinancialOverviewRaw = {
  paidParentPaymentsSar: number;
  pendingPaymentsSar: number;
  failedPaymentsSar: number;
  driverPlatformFeePaidSar: number;
  driverDeductionsPaidSar: number;
  driverBonusesPaidSar: number;
  driverPayoutsCompletedSar: number;
};

export type FinancialOverviewMetrics = {
  paidParentRevenueSar: number;
  driverRetentionPaidSar: number;
  totalRecognizedRevenueSar: number;
  estimatedGrossMarginSar: number;
  estimatedGrossMarginPercent: number;
  pendingRevenueSar: number;
  failedPaymentsSar: number;
};

/** Pure financial overview metrics — mirrors admin financials dashboard formulas. */
export function buildFinancialOverviewMetrics(raw: FinancialOverviewRaw): FinancialOverviewMetrics {
  const paidParentRevenueSar = raw.paidParentPaymentsSar;
  const driverRetentionPaidSar = driverRetentionFromPaid({
    platformFeePaidSar: raw.driverPlatformFeePaidSar,
    deductionsPaidSar: raw.driverDeductionsPaidSar,
    bonusesPaidSar: raw.driverBonusesPaidSar,
  });
  const totalRecognizedRevenueSar = combinedPlatformRevenue({
    parentPaymentsSar: paidParentRevenueSar,
    driverPlatformFeePaidSar: raw.driverPlatformFeePaidSar,
    driverDeductionsPaidSar: raw.driverDeductionsPaidSar,
    driverBonusesPaidSar: raw.driverBonusesPaidSar,
  });
  const estimatedGrossMarginSar = estimatedGrossMargin({
    paidParentRevenueSar,
    driverRetentionPaidSar,
    driverPayoutsCompletedSar: raw.driverPayoutsCompletedSar,
  });

  return {
    paidParentRevenueSar,
    driverRetentionPaidSar,
    totalRecognizedRevenueSar,
    estimatedGrossMarginSar,
    estimatedGrossMarginPercent: estimatedGrossMarginPercent(
      paidParentRevenueSar,
      estimatedGrossMarginSar,
    ),
    pendingRevenueSar: raw.pendingPaymentsSar,
    failedPaymentsSar: raw.failedPaymentsSar,
  };
}

/** Recognized parent revenue includes only PAID payment rows. */
export function sumRecognizedParentRevenue(
  payments: ReadonlyArray<{ status: string; amountSar: number }>,
): number {
  return payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amountSar), 0);
}

/** Wallet balance after a successful wallet-funded subscription payment. */
export function walletBalanceAfterSubscriptionPayment(
  currentBalanceSar: number,
  paymentAmountSar: number,
): number {
  return Math.round((currentBalanceSar - paymentAmountSar + Number.EPSILON) * 100) / 100;
}
