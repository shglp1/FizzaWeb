/**
 * Financials, payroll margin, promo, and subscription economics smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildFinancialOverviewMetrics,
  sumRecognizedParentRevenue,
  walletBalanceAfterSubscriptionPayment,
} from '../lib/financials/financialOverviewMetrics.ts';
import {
  calculateSubscriptionMargin,
  isDriverRateAboveParentDistanceRate,
} from '../lib/financials/subscriptionMargin.ts';
import {
  calculatePeriodNetPay,
  calculateTripEarning,
} from '../lib/payroll/calculateTripEarning.ts';
import {
  aggregatePeriodEconomics,
  combinedPlatformRevenue,
  driverRetentionFromLine,
  driverRetentionFromPaid,
  estimatedGrossMargin,
  estimatedGrossMarginPercent,
  fizzaRetentionFromDrivers,
  totalRecognizedRevenue,
} from '../lib/payroll/platformEconomics.ts';
import { computePromoDiscount } from '../lib/promo/promoCodeRules.ts';
import { remainingPromoUses } from '../lib/promo/promoAdminHelpers.ts';

// ─── Financial overview ───────────────────────────────────────────────────────

test('paid parent subscription increases paid parent revenue', () => {
  const revenue = sumRecognizedParentRevenue([
    { status: 'PAID', amountSar: 500 },
    { status: 'PENDING', amountSar: 200 },
    { status: 'FAILED', amountSar: 100 },
  ]);
  assert.equal(revenue, 500);
});

test('paid wallet-funded subscription increases paid parent revenue', () => {
  const revenue = sumRecognizedParentRevenue([
    { status: 'PAID', amountSar: 350 },
  ]);
  assert.equal(revenue, 350);
});

test('wallet balance decreases when subscription is paid from wallet', () => {
  assert.equal(walletBalanceAfterSubscriptionPayment(1000, 350), 650);
});

test('pending payments do not affect recognized revenue', () => {
  const revenue = sumRecognizedParentRevenue([
    { status: 'PENDING', amountSar: 400 },
    { status: 'PAID', amountSar: 100 },
  ]);
  assert.equal(revenue, 100);
});

test('failed payments do not affect recognized revenue', () => {
  const revenue = sumRecognizedParentRevenue([
    { status: 'FAILED', amountSar: 400 },
    { status: 'PAID', amountSar: 75 },
  ]);
  assert.equal(revenue, 75);
});

test('total recognized revenue equals paidParentRevenue + settled driver retention', () => {
  const metrics = buildFinancialOverviewMetrics({
    paidParentPaymentsSar: 1000,
    pendingPaymentsSar: 200,
    failedPaymentsSar: 50,
    driverPlatformFeePaidSar: 75,
    driverDeductionsPaidSar: 10,
    driverBonusesPaidSar: 5,
    driverPayoutsCompletedSar: 425,
  });
  assert.equal(metrics.driverRetentionPaidSar, 80);
  assert.equal(metrics.totalRecognizedRevenueSar, 1080);
  assert.equal(
    metrics.totalRecognizedRevenueSar,
    metrics.paidParentRevenueSar + metrics.driverRetentionPaidSar,
  );
});

test('estimated gross margin equals paidParentRevenue + driverRetention - driverPayoutsCompleted', () => {
  const metrics = buildFinancialOverviewMetrics({
    paidParentPaymentsSar: 1000,
    pendingPaymentsSar: 0,
    failedPaymentsSar: 0,
    driverPlatformFeePaidSar: 75,
    driverDeductionsPaidSar: 10,
    driverBonusesPaidSar: 5,
    driverPayoutsCompletedSar: 425,
  });
  assert.equal(metrics.estimatedGrossMarginSar, 655);
  assert.equal(
    estimatedGrossMargin({
      paidParentRevenueSar: 1000,
      driverRetentionPaidSar: 80,
      driverPayoutsCompletedSar: 425,
    }),
    655,
  );
});

test('estimated gross margin percentage is calculated correctly', () => {
  assert.equal(estimatedGrossMarginPercent(1000, 655), 65.5);
});

test('estimated gross margin percentage is 0 when paidParentRevenue is 0', () => {
  assert.equal(estimatedGrossMarginPercent(0, 100), 0);
  const metrics = buildFinancialOverviewMetrics({
    paidParentPaymentsSar: 0,
    pendingPaymentsSar: 0,
    failedPaymentsSar: 0,
    driverPlatformFeePaidSar: 0,
    driverDeductionsPaidSar: 0,
    driverBonusesPaidSar: 0,
    driverPayoutsCompletedSar: 0,
  });
  assert.equal(metrics.estimatedGrossMarginPercent, 0);
});

// ─── Promo codes ──────────────────────────────────────────────────────────────

test('promo code discount reduces final paid amount', () => {
  const subtotal = 1000;
  const discount = computePromoDiscount(subtotal, 10);
  assert.equal(discount, 100);
  assert.equal(subtotal - discount, 900);
});

test('promo code dashboard tracks discount given and paid after discount', () => {
  const subtotal = 800;
  const discount = computePromoDiscount(subtotal, 25);
  const paid = subtotal - discount;
  assert.equal(discount, 200);
  assert.equal(paid, 600);
});

test('promo code redemption count and remaining uses', () => {
  const before = { maxUses: 5, useCount: 2 };
  const afterUseCount = before.useCount + 1;
  assert.equal(remainingPromoUses(before), 3);
  assert.equal(remainingPromoUses({ maxUses: 5, useCount: afterUseCount }), 2);
});

// ─── Driver payroll ───────────────────────────────────────────────────────────

test('driverGross = billableKm × driverRatePerKm', () => {
  const trip = calculateTripEarning({ billableKm: 10, ratePerKmSar: 2, platformFeePercent: 15 });
  assert.equal(trip.grossSar, 20);
});

test('platformFee = driverGross × platformFeePercent', () => {
  const trip = calculateTripEarning({ billableKm: 10, ratePerKmSar: 2, platformFeePercent: 15 });
  assert.equal(trip.platformFeeSar, 3);
});

test('driverNetPay = driverGross − platformFee − deductions + bonuses', () => {
  const trip = calculateTripEarning({ billableKm: 10, ratePerKmSar: 2, platformFeePercent: 15 });
  assert.equal(calculatePeriodNetPay({ tripNetSar: trip.netSar, deductionsSar: 2, bonusesSar: 5 }), 20);
});

test('driverRetention = platformFee + deductions − bonuses', () => {
  assert.equal(
    driverRetentionFromLine({ platformFeeSar: 3, deductionsSar: 2, bonusesSar: 5 }),
    0,
  );
  assert.equal(
    driverRetentionFromPaid({ platformFeePaidSar: 75, deductionsPaidSar: 10, bonusesPaidSar: 5 }),
    80,
  );
});

test('draft and approved payroll do not affect completed driver payout totals', () => {
  const economics = aggregatePeriodEconomics([
    {
      grossSar: 100,
      platformFeeSar: 15,
      tripNetSar: 85,
      deductionsSar: 0,
      bonusesSar: 0,
      netPaySar: 85,
      status: 'DRAFT',
    },
    {
      grossSar: 200,
      platformFeeSar: 30,
      tripNetSar: 170,
      deductionsSar: 5,
      bonusesSar: 10,
      netPaySar: 175,
      status: 'APPROVED',
    },
    {
      grossSar: 300,
      platformFeeSar: 45,
      tripNetSar: 255,
      deductionsSar: 0,
      bonusesSar: 0,
      netPaySar: 255,
      status: 'PAID',
    },
  ]);
  assert.equal(economics.paidNet, 255);
  assert.equal(economics.netPay, 515);
  assert.equal(economics.paidPlatformFee, 45);
  assert.equal(economics.paidDeductions, 0);
  assert.equal(economics.paidBonuses, 0);
  assert.equal(
    driverRetentionFromPaid({
      platformFeePaidSar: economics.paidPlatformFee,
      deductionsPaidSar: economics.paidDeductions,
      bonusesPaidSar: economics.paidBonuses,
    }),
    45,
  );
});

test('only paid payroll affects completed driver payouts and settled driver retention', () => {
  const economics = aggregatePeriodEconomics([
    {
      grossSar: 81.5,
      platformFeeSar: 8.15,
      tripNetSar: 73.35,
      deductionsSar: 10,
      bonusesSar: 0,
      netPaySar: 63.35,
      status: 'PAID',
    },
  ]);
  assert.equal(economics.paidNet, 63.35);
  assert.equal(
    combinedPlatformRevenue({
      parentPaymentsSar: 500,
      driverPlatformFeePaidSar: economics.paidPlatformFee,
      driverDeductionsPaidSar: economics.paidDeductions,
      driverBonusesPaidSar: economics.paidBonuses,
    }),
    518.15,
  );
  assert.equal(
    totalRecognizedRevenue({
      paidParentRevenueSar: 500,
      driverRetentionPaidSar: fizzaRetentionFromDrivers(economics),
    }),
    518.15,
  );
});

// ─── Per-subscription margin ──────────────────────────────────────────────────

test('subscription margin formula uses revenue minus estimated driver payout', () => {
  const margin = calculateSubscriptionMargin({
    subscriptionRevenueSar: 1000,
    totalChargeableDistanceKm: 100,
    driverRatePerKmSar: 2,
    platformFeePercent: 15,
  });
  assert.equal(margin.estimatedDriverGrossSar, 200);
  assert.equal(margin.estimatedPlatformFeeSar, 30);
  assert.equal(margin.estimatedDriverPayoutSar, 170);
  assert.equal(margin.estimatedSubscriptionMarginSar, 830);
});

test('incorrect double-count margin formula is not used', () => {
  const margin = calculateSubscriptionMargin({
    subscriptionRevenueSar: 1000,
    totalChargeableDistanceKm: 100,
    driverRatePerKmSar: 2,
    platformFeePercent: 15,
  });
  const incorrect = 1000 + margin.estimatedPlatformFeeSar - margin.estimatedDriverPayoutSar;
  assert.notEqual(margin.estimatedSubscriptionMarginSar, incorrect);
  assert.equal(margin.estimatedSubscriptionMarginSar, 830);
});

test('admin warning appears when driverRatePerKm > parentDistanceRatePerKm', () => {
  assert.equal(isDriverRateAboveParentDistanceRate(2.5, 2), true);
  assert.equal(isDriverRateAboveParentDistanceRate(2, 2), false);
});

test('admin financials UI uses recognized revenue and margin labels', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/app/admin/sections/FinancialsSection.tsx'),
    'utf8',
  );
  assert.match(src, /Total recognized revenue/);
  assert.match(src, /Parent paid transactions/);
  assert.match(src, /Estimated Platform Margin/);
  assert.match(src, /Estimated gross margin/);
  assert.doesNotMatch(src, /Total platform revenue/);
  assert.doesNotMatch(src, /platform profit/i);
});

test('subscription margin is admin-only in UI', () => {
  const adminSrc = readFileSync(
    join(process.cwd(), 'src/app/admin/sections/SubscriptionsSection.tsx'),
    'utf8',
  );
  const parentSrc = readFileSync(
    join(process.cwd(), 'src/app/subscriptions/new/page.tsx'),
    'utf8',
  );
  assert.match(adminSrc, /Estimated subscription margin/);
  assert.doesNotMatch(parentSrc, /Estimated subscription margin/i);
  assert.doesNotMatch(parentSrc, /calculateSubscriptionMargin/);
});

test('financials overview API exposes margin metrics', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/app/api/admin/financials/overview/route.ts'),
    'utf8',
  );
  assert.match(src, /buildFinancialOverviewMetrics/);
  assert.match(src, /estimatedGrossMarginSar/);
  assert.match(src, /totalRecognizedRevenueSar/);
  assert.match(src, /status: 'PAID'/);
});
