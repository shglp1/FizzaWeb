/**
 * Dashboard vs Live GPS classification consistency.
 * Uses dynamic date so tests remain valid on any calendar day.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTripForRole,
  computeTripCountsForRole,
  groupTripsByTrackingGroup,
} from '../lib/trips/tripClassification.ts';

// Dynamic today so the test does not become stale as calendar advances.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function pastDateIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const today = todayIso();
const nowTodayMs = new Date(`${today}T07:00:00.000Z`).getTime();

test('opens_soon trip counts in remainingToday and tracking opens_soon', () => {
  const trip = {
    status: 'DRIVER_ASSIGNED',
    scheduledDate: today,
    scheduledPickupTime: `${today}T20:00:00.000Z`,
  };
  const c = classifyTripForRole(trip, { role: 'DRIVER', nowMs: nowTodayMs });
  assert.equal(c.trackingGroup, 'opens_soon');
  const counts = computeTripCountsForRole([trip], { role: 'DRIVER', nowMs: nowTodayMs });
  assert.ok(counts.remainingToday >= 1);
  const groups = groupTripsByTrackingGroup([trip], { role: 'DRIVER', nowMs: nowTodayMs });
  assert.equal(groups.opens_soon.length, 1);
});

test('zero remaining today when only stale trips on board', () => {
  const staleDate = pastDateIso(5);
  const stale = {
    status: 'DRIVER_ASSIGNED',
    scheduledDate: staleDate,
    scheduledPickupTime: `${staleDate}T04:10:00.000Z`,
  };
  const counts = computeTripCountsForRole([stale], { role: 'DRIVER', nowMs: nowTodayMs });
  assert.equal(counts.remainingToday, 0);
  const groups = groupTripsByTrackingGroup([stale], { role: 'DRIVER', nowMs: nowTodayMs });
  assert.equal(groups.needs_review.length, 1);
  assert.equal(groups.opens_soon.length, 0);
});
