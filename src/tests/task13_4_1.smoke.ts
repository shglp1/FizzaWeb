/**
 * Task 13.4.1 — Driver portal polish smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  MAP_FALLBACK_LABEL,
  TRACKING_GROUP_LABELS,
  truncateRouteLabel,
  groupTripsByTrackingAvailability,
  getDriverPrimaryAction,
  DRIVER_TRACKING_LIST_COPY,
  isDriverRole,
} from '../lib/ui/driverPortal.ts';
import { getMobileNavItemsForDriverState } from '../lib/mobileNav.ts';

test('truncateRouteLabel shortens long addresses', () => {
  const long = 'A'.repeat(60);
  const out = truncateRouteLabel(long, 42);
  assert.ok(out.length <= 42);
  assert.ok(out.endsWith('…'));
});

test('tracking availability grouping for driver list', () => {
  const groups = groupTripsByTrackingAvailability([
    { status: 'ON_THE_WAY', scheduledPickupTime: new Date(Date.now() - 600_000).toISOString() },
    { status: 'DRIVER_ASSIGNED', scheduledPickupTime: new Date(Date.now() + 60 * 60_000).toISOString() },
  ]);
  assert.equal(groups.available_now.length, 1);
  assert.equal(groups.opens_soon.length, 1);
});

test('map fallback label is user-friendly', () => {
  assert.match(MAP_FALLBACK_LABEL, /Map unavailable/i);
  assert.match(MAP_FALLBACK_LABEL, /coordinates/i);
});

test('driver primary action shows GPS window reason', () => {
  const action = getDriverPrimaryAction('DRIVER_ASSIGNED', false);
  assert.equal(action.disabled, true);
  assert.match(action.disabledReason ?? '', /10 minutes/i);
});

test('driver vs parent tracking copy branches', () => {
  assert.match(DRIVER_TRACKING_LIST_COPY.driver, /Share your live location/i);
  assert.match(DRIVER_TRACKING_LIST_COPY.parent, /child/i);
});

test('mobile nav uses Route label for driver', () => {
  const items = getMobileNavItemsForDriverState('APPROVED_DRIVER')!;
  assert.ok(items.some((i) => i.label === 'Route Sheet'));
});

test('isDriverRole helper', () => {
  assert.equal(isDriverRole('DRIVER'), true);
  assert.equal(isDriverRole('PARENT'), false);
});

test('tracking group labels defined', () => {
  assert.equal(TRACKING_GROUP_LABELS.available_now, 'Available now');
  assert.equal(TRACKING_GROUP_LABELS.opens_soon, 'Opens soon');
});

test('DriverUI exports enterprise components', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/driver/DriverUI.tsx'), 'utf8');
  for (const name of [
    'DriverCommandHeader',
    'DriverActionHero',
    'DriverKpiCard',
    'DriverRouteCard',
    'DriverRouteTimeline',
    'DriverBottomActionBar',
    'DriverMapPanel',
    'DriverNotice',
  ]) {
    assert.ok(src.includes(`export function ${name}`), `missing ${name}`);
  }
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(src), 'driver UI should not contain emoji');
});
