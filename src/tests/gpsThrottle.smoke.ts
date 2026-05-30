/**
 * Smoke tests for the server-side GPS write throttle (perf audit, Phase 4).
 *
 * Verifies that:
 *   - the first write for a trip is never throttled
 *   - subsequent writes within the cooldown window are throttled
 *   - writes after the cooldown window are allowed again
 *   - throttling is isolated per trip
 *   - recordGpsWrite resets the window
 *
 * Pure logic over the real module (deterministic clock injected via `now`).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldThrottleGps,
  recordGpsWrite,
  __resetGpsThrottle,
  GPS_THROTTLE_MS,
} from '../lib/tracking/gpsThrottle.ts';

test('gpsThrottle: first write for a trip is not throttled', () => {
  __resetGpsThrottle();
  assert.equal(shouldThrottleGps('trip-1', 1_000), false);
});

test('gpsThrottle: a write within the cooldown window is throttled', () => {
  __resetGpsThrottle();
  recordGpsWrite('trip-1', 1_000);
  assert.equal(shouldThrottleGps('trip-1', 1_000 + GPS_THROTTLE_MS - 1), true);
});

test('gpsThrottle: a write after the cooldown window is allowed', () => {
  __resetGpsThrottle();
  recordGpsWrite('trip-1', 1_000);
  assert.equal(shouldThrottleGps('trip-1', 1_000 + GPS_THROTTLE_MS), false);
});

test('gpsThrottle: throttling is isolated per trip', () => {
  __resetGpsThrottle();
  recordGpsWrite('trip-1', 1_000);
  // A different trip is unaffected by trip-1's recent write.
  assert.equal(shouldThrottleGps('trip-2', 1_000), false);
});

test('gpsThrottle: recording a new write resets the window', () => {
  __resetGpsThrottle();
  recordGpsWrite('trip-1', 1_000);
  // Move past the window and write again.
  const t2 = 1_000 + GPS_THROTTLE_MS + 10;
  recordGpsWrite('trip-1', t2);
  // Now the window is measured from t2.
  assert.equal(shouldThrottleGps('trip-1', t2 + 1), true);
  assert.equal(shouldThrottleGps('trip-1', t2 + GPS_THROTTLE_MS), false);
});
