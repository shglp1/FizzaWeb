/**
 * Shared trip classification smoke tests (Enterprise PR 1).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTripForRole,
  computeTripCountsForRole,
  groupTripsByTrackingGroup,
  isNeedsDispatchOperational,
  isTripPayrollEligible,
  partitionTripsByReview,
} from '../lib/trips/tripClassification.ts';

const may29 = '2026-05-29';
const may30 = '2026-05-30';
const nowMay29Ms = new Date(`${may29}T07:00:00.000Z`).getTime();

function trip(overrides: Partial<{
  status: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  needsDispatch: boolean;
}>) {
  return {
    status: 'DRIVER_ASSIGNED',
    scheduledDate: may29,
    scheduledPickupTime: `${may29}T04:10:00.000Z`,
    ...overrides,
  };
}

test('stale May 24 trip classified as stale for driver', () => {
  const c = classifyTripForRole(
    trip({ scheduledDate: '2026-05-24', scheduledPickupTime: '2026-05-24T04:10:00.000Z' }),
    { role: 'DRIVER', nowMs: nowMay29Ms },
  );
  assert.equal(c.category, 'stale');
  assert.equal(c.isStale, true);
  assert.equal(c.trackingGroup, 'needs_review');
  assert.equal(c.earningsEligibility, 'needs_financial_review');
});

test('today trip opens_soon only when business date is today', () => {
  const c = classifyTripForRole(
    trip({ scheduledPickupTime: `${may29}T20:00:00.000Z` }),
    { role: 'DRIVER', nowMs: nowMay29Ms },
  );
  assert.equal(c.businessDateKey, may29);
  assert.equal(c.trackingGroup, 'opens_soon');
});

test('tomorrow trip is upcoming not opens_soon even if pickup within hours', () => {
  const c = classifyTripForRole(
    trip({ scheduledDate: may30, scheduledPickupTime: `${may30}T04:10:00.000Z` }),
    { role: 'DRIVER', nowMs: new Date(`${may29}T18:00:00.000Z`).getTime() },
  );
  assert.equal(c.category, 'upcoming');
  assert.equal(c.trackingGroup, 'upcoming');
});

test('needs dispatch past date is not operational', () => {
  assert.equal(
    isNeedsDispatchOperational(
      { status: 'SCHEDULED', scheduledDate: '2026-05-26', needsDispatch: true },
      nowMay29Ms,
    ),
    false,
  );
  assert.equal(
    isNeedsDispatchOperational(
      { status: 'SCHEDULED', scheduledDate: may29, needsDispatch: true },
      nowMay29Ms,
    ),
    true,
  );
});

test('partition separates stale from normal', () => {
  const { normal, stale } = partitionTripsByReview(
    [
      trip({ scheduledDate: '2026-05-24', scheduledPickupTime: '2026-05-24T04:10:00.000Z' }),
      trip({ scheduledPickupTime: `${may29}T15:00:00.000Z` }),
    ],
    { role: 'DRIVER', nowMs: nowMay29Ms },
  );
  assert.equal(normal.length, 1);
  assert.equal(stale.length, 1);
});

test('tracking groups put stale in needs_review', () => {
  const groups = groupTripsByTrackingGroup(
    [
      trip({ scheduledDate: '2026-05-24', scheduledPickupTime: '2026-05-24T04:10:00.000Z' }),
      trip({ scheduledPickupTime: `${may29}T20:00:00.000Z` }),
    ],
    { role: 'DRIVER', nowMs: nowMay29Ms },
  );
  assert.equal(groups.needs_review.length, 1);
  assert.equal(groups.opens_soon.length, 1);
});

test('completed trip is payroll eligible by default', () => {
  assert.equal(
    isTripPayrollEligible({ status: 'COMPLETED', scheduledDate: may29, scheduledPickupTime: `${may29}T04:10:00.000Z` }),
    true,
  );
});

test('completed with pending financial review is not payroll eligible', () => {
  assert.equal(
    isTripPayrollEligible({
      status: 'COMPLETED',
      scheduledDate: may29,
      scheduledPickupTime: `${may29}T04:10:00.000Z`,
      financialReviewStatus: 'PENDING',
    }),
    false,
  );
});

test('counts exclude stale from remaining today', () => {
  const counts = computeTripCountsForRole(
    [
      trip({ scheduledDate: '2026-05-24', scheduledPickupTime: '2026-05-24T04:10:00.000Z' }),
      trip({ scheduledPickupTime: `${may29}T15:00:00.000Z` }),
    ],
    { role: 'DRIVER', nowMs: nowMay29Ms },
  );
  assert.equal(counts.stale, 1);
  assert.equal(counts.remainingToday, 1);
});
