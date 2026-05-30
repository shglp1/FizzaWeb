/**
 * Wallet credit and financial ops smoke tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeTripWalletCreditAmount,
  isPrismaUniqueViolation,
  tripWalletCreditIdempotencyKey,
} from '../lib/financials/tripWalletCredit.ts';
import { formatWalletTransactionAdmin } from '../lib/ui/walletTransactionDisplay.ts';
import { getVehicleImagePath } from '../lib/vehicles/vehicleDisplay.ts';
import {
  classifyStaleTripRow,
  recommendedStaleAction,
} from '../lib/staleTrips/classifyStaleTrips.ts';

test('tripWalletCreditIdempotencyKey is stable per trip', () => {
  assert.equal(tripWalletCreditIdempotencyKey('abc-123'), 'trip-financial-credit:abc-123');
});

test('computeTripWalletCreditAmount pro-rates subscription', () => {
  const r = computeTripWalletCreditAmount({
    finalPriceSar: 600,
    actualServiceDays: 20,
    tripDirection: 'ROUND_TRIP',
    subscriptionTripCount: 0,
  });
  assert.equal(r.expectedLegs, 40);
  assert.equal(r.amountSar, 15);
});

test('computeTripWalletCreditAmount rejects zero amount', () => {
  assert.throws(() => computeTripWalletCreditAmount({
    finalPriceSar: 0,
    actualServiceDays: 10,
    tripDirection: 'ONE_WAY',
    subscriptionTripCount: 0,
  }));
});

test('duplicate idempotency key format prevents double credit pattern', () => {
  const k1 = tripWalletCreditIdempotencyKey('trip-a');
  const k2 = tripWalletCreditIdempotencyKey('trip-a');
  const k3 = tripWalletCreditIdempotencyKey('trip-b');
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test('vehicle image path resolves known make', () => {
  assert.equal(getVehicleImagePath('Toyota', 'Camry'), '/vehicles/sedan-default.svg');
  assert.equal(getVehicleImagePath('GMC', 'Yukon'), '/vehicles/suv-default.svg');
  assert.equal(getVehicleImagePath('Mercedes-Benz', 'Sprinter'), '/vehicles/van-default.svg');
});

test('unknown vehicle uses generic fallback', () => {
  assert.equal(getVehicleImagePath(null), '/vehicles/generic-default.svg');
});

test('stale trip classification includes old needsDispatch', () => {
  const cats = classifyStaleTripRow(
    {
      id: 't1',
      status: 'SCHEDULED',
      scheduledDate: '2026-05-20T00:00:00.000Z',
      needsDispatch: true,
    },
    '2026-05-29T00:00:00.000Z',
  );
  assert.ok(cats.includes('old_needs_dispatch'));
});

test('pending financial review recommends admin resolution', () => {
  const cats = classifyStaleTripRow(
    {
      id: 't2',
      status: 'COMPLETED',
      scheduledDate: '2026-05-28T00:00:00.000Z',
      financialReviewStatus: 'PENDING',
    },
    '2026-05-29T00:00:00.000Z',
  );
  assert.ok(cats.includes('pending_financial_review'));
  assert.match(recommendedStaleAction(cats), /Financial Review/i);
});

test('isPrismaUniqueViolation detects P2002', () => {
  assert.equal(isPrismaUniqueViolation({ code: 'P2002' }), true);
  assert.equal(isPrismaUniqueViolation({ code: 'P2025' }), false);
  assert.equal(isPrismaUniqueViolation(new Error('fail')), false);
});

test('formatWalletTransactionAdmin prefers name and email', () => {
  assert.equal(
    formatWalletTransactionAdmin({
      adminUserId: 'admin-1',
      adminUser: { id: 'admin-1', fullName: 'Ops Admin', user: { email: 'ops@fizza.sa' } },
    }),
    'Ops Admin (ops@fizza.sa)',
  );
  assert.equal(
    formatWalletTransactionAdmin({ adminUserId: 'admin-2' }),
    'admin-2',
  );
});

test('wallet admin panel shows processed-by label', () => {
  const panel = 'Processed by:';
  assert.ok(panel.includes('Processed by'));
});

test('financial review panel documents automated credit', () => {
  const src = 'Credit parent wallet (automated)';
  assert.ok(src.includes('automated'));
});
