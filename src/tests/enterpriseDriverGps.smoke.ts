/**
 * Dashboard vs Live GPS classification consistency.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTripForRole,
  computeTripCountsForRole,
  groupTripsByTrackingGroup,
} from '../lib/trips/tripClassification.ts';

const may29 = '2026-05-29';
const nowMay29Ms = new Date(`${may29}T07:00:00.000Z`).getTime();

test('opens_soon trip counts in remainingToday and tracking opens_soon', () => {
  const trip = {
    status: 'DRIVER_ASSIGNED',
    scheduledDate: may29,
    scheduledPickupTime: `${may29}T20:00:00.000Z`,
  };
  const c = classifyTripForRole(trip, { role: 'DRIVER', nowMs: nowMay29Ms });
  assert.equal(c.trackingGroup, 'opens_soon');
  const counts = computeTripCountsForRole([trip], { role: 'DRIVER', nowMs: nowMay29Ms });
  assert.ok(counts.remainingToday >= 1);
  const groups = groupTripsByTrackingGroup([trip], { role: 'DRIVER', nowMs: nowMay29Ms });
  assert.equal(groups.opens_soon.length, 1);
});

test('zero remaining today when only stale trips on board', () => {
  const stale = {
    status: 'DRIVER_ASSIGNED',
    scheduledDate: '2026-05-24',
    scheduledPickupTime: '2026-05-24T04:10:00.000Z',
  };
  const counts = computeTripCountsForRole([stale], { role: 'DRIVER', nowMs: nowMay29Ms });
  assert.equal(counts.remainingToday, 0);
  const groups = groupTripsByTrackingGroup([stale], { role: 'DRIVER', nowMs: nowMay29Ms });
  assert.equal(groups.needs_review.length, 1);
  assert.equal(groups.opens_soon.length, 0);
});
