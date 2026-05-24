/**
 * Task 13.4 — Driver portal redesign smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  DRIVER_NAV_LABELS,
  DRIVER_TRACKING_LIST_COPY,
  DRIVER_SAFETY_STATUS_LABEL,
  getDriverPrimaryAction,
  getDriverStatusActionLabel,
  getTrackingAvailability,
  groupNotificationsByDay,
  hasRouteCoordinates,
  hasRenderableMapPoints,
  mapNotificationCategory,
} from '../lib/ui/driverPortal.ts';
import { DRIVER_NAV, getNavigationForRole } from '../lib/roleRoutes.ts';
import { getMobileNavItemsForDriverState } from '../lib/mobileNav.ts';

test('driver nav labels updated for route sheet and live GPS', () => {
  assert.equal(DRIVER_NAV_LABELS.routeSheet, 'Route Sheet');
  assert.equal(DRIVER_NAV_LABELS.liveGps, 'Live GPS');
  assert.equal(DRIVER_NAV_LABELS.safetyCenter, 'Safety Center');

  const nav = getNavigationForRole('DRIVER');
  assert.ok(nav.main.some((i) => i.label === 'Route Sheet' && i.href === '/trips'));
  assert.ok(nav.main.some((i) => i.label === 'Live GPS' && i.href === '/tracking'));
  assert.ok(nav.main.some((i) => i.label === 'Safety Center' && i.href === '/safety'));
  assert.ok(!nav.main.some((i) => i.href === '/dashboard'));
  assert.ok(!nav.main.some((i) => i.href === '/admin'));
});

test('mobile nav for approved driver uses route sheet label', () => {
  const items = getMobileNavItemsForDriverState('APPROVED_DRIVER')!;
  assert.ok(items.some((i) => i.label === 'Route Sheet' && i.href === '/trips'));
  assert.ok(items.some((i) => i.label === 'Live GPS' && i.href === '/tracking'));
  assert.ok(!items.some((i) => i.href === '/riders'));
});

test('driver status action labels', () => {
  assert.equal(getDriverStatusActionLabel('ARRIVED_PICKUP'), 'Rider picked up');
  assert.equal(getDriverPrimaryAction('DRIVER_ASSIGNED', true).label, 'Start pre-trip');
  const blocked = getDriverPrimaryAction('DRIVER_ASSIGNED', false);
  assert.equal(blocked.kind, 'navigate');
  assert.equal(blocked.disabled, true);
});

test('tracking availability for driver trips', () => {
  const soon = getTrackingAvailability({
    status: 'DRIVER_ASSIGNED',
    scheduledPickupTime: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  assert.equal(soon.availability, 'opens_soon');

  const now = getTrackingAvailability({
    status: 'ON_THE_WAY',
    scheduledPickupTime: new Date(Date.now() - 5 * 60_000).toISOString(),
  });
  assert.equal(now.availability, 'available_now');
});

test('tracking map fallback when coordinates missing', () => {
  assert.equal(hasRouteCoordinates({ pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null }), false);
  assert.equal(hasRenderableMapPoints({ pickupLat: 24.5, pickupLng: 39.6 }), true);
  assert.equal(hasRenderableMapPoints({}), false);
});

test('TripTrackingMap does not reference default Leaflet marker assets', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/tracking/TripTrackingMap.tsx'), 'utf8');
  assert.ok(!src.includes('marker-icon.png'));
  assert.ok(!src.includes('Icon.Default'));
  assert.ok(src.includes('divIcon'));
});

test('GPS copy differs by role', () => {
  assert.match(DRIVER_TRACKING_LIST_COPY.driver, /Share your live location/i);
  assert.match(DRIVER_TRACKING_LIST_COPY.parent, /child/i);
  assert.notEqual(DRIVER_TRACKING_LIST_COPY.driver, DRIVER_TRACKING_LIST_COPY.parent);
});

test('safety status labels for driver', () => {
  assert.equal(DRIVER_SAFETY_STATUS_LABEL.PENDING, 'Under review');
  assert.equal(DRIVER_SAFETY_STATUS_LABEL.RESOLVED, 'Resolved');
});

test('notification grouping today vs earlier', () => {
  const now = new Date('2026-05-24T15:00:00.000Z');
  const { today, earlier } = groupNotificationsByDay(
    [
      { createdAt: '2026-05-24T10:00:00.000Z' },
      { createdAt: '2026-05-23T10:00:00.000Z' },
    ],
    now,
  );
  assert.equal(today.length, 1);
  assert.equal(earlier.length, 1);
});

test('notification category mapping', () => {
  assert.equal(mapNotificationCategory('TRIP'), 'Trip');
  assert.equal(mapNotificationCategory('SAFETY'), 'Safety');
  assert.equal(mapNotificationCategory('DRIVER_APPLICATION'), 'Dispatch');
});

test('driver nav from DRIVER_NAV constant', () => {
  assert.deepEqual(
    DRIVER_NAV.map((i) => i.label),
    ['Dashboard', 'Route Sheet', 'Live GPS', 'Safety Center', 'Notifications'],
  );
});
