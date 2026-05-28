/**
 * Task 20 — Trip lifecycle hardening (Phase 1 & 2) smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { isValidTransition, DRIVER_TRANSITIONS } from '../lib/trips/tripLifecycle.ts';
import { getDriverPrimaryAction } from '../lib/ui/driverPortal.ts';
import {
  getStatusConfirmKind,
  getStatusConfirmCopy,
  statusAdvanceNeedsGpsWarning,
  getDriverActionLabel,
} from '../lib/ui/driverLifecycleConfirm.ts';
import { buildParentSafetyTimeline, resolveParentTrackingState } from '../lib/parent/parentTrackingState.ts';
import { headlineForState } from '../lib/parent/parentTrackingCopy.ts';

test('driver cannot skip PRE_TRIP from DRIVER_ASSIGNED', () => {
  assert.ok(isValidTransition('DRIVER_ASSIGNED', 'PRE_TRIP', 'DRIVER'));
  assert.ok(!isValidTransition('DRIVER_ASSIGNED', 'ON_THE_WAY', 'DRIVER'));
});

test('admin can still skip PRE_TRIP', () => {
  assert.ok(isValidTransition('DRIVER_ASSIGNED', 'ON_THE_WAY', 'ADMIN'));
});

test('DRIVER_ASSIGNED driver transitions are PRE_TRIP only', () => {
  assert.deepEqual(DRIVER_TRANSITIONS.DRIVER_ASSIGNED, ['PRE_TRIP']);
});

test('confirm kinds for critical statuses', () => {
  assert.equal(getStatusConfirmKind('PICKED_UP'), 'picked_up');
  assert.equal(getStatusConfirmKind('COMPLETED'), 'complete_trip');
  assert.equal(getStatusConfirmKind('NO_SHOW'), 'no_show');
  assert.equal(getStatusConfirmKind('ON_THE_WAY'), null);
});

test('GPS warning statuses', () => {
  assert.ok(statusAdvanceNeedsGpsWarning('ON_THE_WAY'));
  assert.ok(statusAdvanceNeedsGpsWarning('PICKED_UP'));
  assert.ok(statusAdvanceNeedsGpsWarning('COMPLETED'));
  assert.ok(!statusAdvanceNeedsGpsWarning('PRE_TRIP'));
});

test('leg-aware driver action labels', () => {
  assert.equal(getDriverActionLabel('DRIVER_ASSIGNED'), 'Start trip');
  assert.equal(getDriverActionLabel('EN_ROUTE_DROPOFF', 'OUTBOUND'), 'Arrived at school');
  assert.equal(getDriverActionLabel('EN_ROUTE_DROPOFF', 'RETURN'), 'Arrived home');
  assert.equal(getDriverActionLabel('ARRIVED_DROPOFF'), 'Complete trip — student delivered');
});

test('getDriverPrimaryAction uses leg-aware drop-off label', () => {
  const outbound = getDriverPrimaryAction('EN_ROUTE_DROPOFF', true, { legType: 'OUTBOUND' });
  assert.equal(outbound.label, 'Arrived at school');
  const ret = getDriverPrimaryAction('EN_ROUTE_DROPOFF', true, { legType: 'RETURN' });
  assert.equal(ret.label, 'Arrived home');
});

test('confirm copy requires reason for no-show', () => {
  const copy = getStatusConfirmCopy('no_show', 'Sara', 'OUTBOUND');
  assert.ok(copy.requireReason);
  assert.match(copy.confirmLabel, /no-show/i);
});

test('ARRIVED_DROPOFF parent state differs from COMPLETED', () => {
  const arrived = resolveParentTrackingState({
    status: 'ARRIVED_DROPOFF',
    legType: 'OUTBOUND',
    hasDriver: true,
    location: { lat: 24.7, lng: 46.7, recordedAt: new Date().toISOString(), stale: false },
    scheduledPickupTime: new Date(Date.now() - 30 * 60_000).toISOString(),
    nowMs: Date.now(),
  });
  assert.equal(arrived.id, 'arrived_at_destination');
  assert.notEqual(headlineForState('trip_completed'), headlineForState('arrived_at_destination'));
});

test('safety timeline splits arrived vs completed', () => {
  const atSchool = buildParentSafetyTimeline({
    status: 'ARRIVED_DROPOFF',
    legType: 'OUTBOUND',
    actualPickupTime: null,
    actualDropoffTime: null,
  });
  const arrivedStep = atSchool.find((s) => s.key === 'arrived');
  const doneStep = atSchool.find((s) => s.key === 'done');
  assert.ok(arrivedStep?.active);
  assert.equal(doneStep?.done, false);
  assert.equal(doneStep?.label, 'Arrived safely');

  const completed = buildParentSafetyTimeline({
    status: 'COMPLETED',
    legType: 'OUTBOUND',
    actualPickupTime: null,
    actualDropoffTime: '2026-05-24T08:00:00.000Z',
  });
  assert.ok(completed.find((s) => s.key === 'done')?.done);
});

test('driver confirm dialog component exists and is wired', () => {
  const trackingView = readFileSync(join(process.cwd(), 'src/components/driver/DriverTrackingView.tsx'), 'utf8');
  const routeSheet = readFileSync(join(process.cwd(), 'src/components/driver/DriverRouteSheet.tsx'), 'utf8');
  assert.match(trackingView, /DriverStatusConfirmDialog/);
  assert.match(routeSheet, /DriverStatusConfirmDialog/);
  assert.match(trackingView, /ARRIVED_DROPOFF/);
});
