/**
 * Task 13.4.2 — Driver portal production gaps smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DRIVER_QUICK_REPLIES } from '../lib/trips/chatModeration.ts';
import {
  CHAT_UNAVAILABLE_BEFORE_LABEL,
  ROUTE_GEOMETRY_FALLBACK_LABEL,
  GPS_DENIED_INSTRUCTIONS,
  GPS_PERMISSION_EXPLAIN,
  buildDriverTripsListParams,
  getChatUnavailableReason,
  getDriverMoreMenuActions,
  getGpsPermissionLabel,
  formatTripActivityLabel,
  getWeekDateRange,
} from '../lib/ui/driverPortal.ts';

test('driver quick replies match production set', () => {
  assert.ok(DRIVER_QUICK_REPLIES.includes('I have arrived.'));
  assert.ok(DRIVER_QUICK_REPLIES.includes('I am on my way.'));
  assert.ok(DRIVER_QUICK_REPLIES.includes('Please come to the pickup point.'));
});

test('chat unavailable before pickup label', () => {
  assert.match(CHAT_UNAVAILABLE_BEFORE_LABEL, /20 minutes/i);
  const reason = getChatUnavailableReason({
    windowOpen: false,
    scheduledPickupTime: new Date(Date.now() + 60 * 60_000).toISOString(),
    chatClosedAt: null,
    status: 'DRIVER_ASSIGNED',
  });
  assert.equal(reason, CHAT_UNAVAILABLE_BEFORE_LABEL);
});

test('More menu includes production actions', () => {
  const actions = getDriverMoreMenuActions({
    id: 't1',
    status: 'ON_THE_WAY',
    scheduledPickupTime: new Date().toISOString(),
    pickupLocation: 'School A',
    dropoffLocation: 'Home B',
  });
  assert.ok(actions.some((a) => a.label === 'Open tracking'));
  assert.ok(actions.some((a) => a.label === 'Copy pickup address'));
  assert.ok(!actions.every((a) => a.disabled));
});

test('no-show only at arrived pickup', () => {
  const atPickup = getDriverMoreMenuActions({
    id: 't1', status: 'ARRIVED_PICKUP', scheduledPickupTime: null,
    pickupLocation: 'A', dropoffLocation: 'B',
  });
  assert.ok(atPickup.some((a) => a.id === 'no_show'));

  const enRoute = getDriverMoreMenuActions({
    id: 't1', status: 'ON_THE_WAY', scheduledPickupTime: null,
    pickupLocation: 'A', dropoffLocation: 'B',
  });
  assert.ok(!enRoute.some((a) => a.id === 'no_show'));
});

test('This Week uses server date range params', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');
  const week = getWeekDateRange(now);
  assert.equal(week.from, '2026-05-24');
  assert.equal(week.to, '2026-05-30');

  const params = buildDriverTripsListParams('week', 1, 50, now);
  assert.equal(params.from, week.from);
  assert.equal(params.to, week.to);
  assert.equal(params.status, undefined);
});

test('GPS permission labels and denied instructions', () => {
  assert.match(GPS_PERMISSION_EXPLAIN, /live location/i);
  assert.match(GPS_DENIED_INSTRUCTIONS, /site settings/i);
  assert.match(getGpsPermissionLabel('denied_permanent'), /browser settings/i);
});

test('route geometry fallback label', () => {
  assert.match(ROUTE_GEOMETRY_FALLBACK_LABEL, /approximate route/i);
});

test('route API does not expose ORS key to client', () => {
  const api = readFileSync(join(process.cwd(), 'src/app/api/maps/route/route.ts'), 'utf8');
  const mapsService = readFileSync(join(process.cwd(), 'src/services/mapsService.ts'), 'utf8');
  assert.ok(!mapsService.includes('OPENROUTESERVICE'));
  assert.ok(mapsService.includes('/api/maps/route'));
  assert.ok(api.includes('getRouteGeometryFromCoords'));
});

test('activity timeline formatter', () => {
  assert.equal(formatTripActivityLabel('RIDER_PICKED_UP', null), 'Rider picked up');
  assert.equal(formatTripActivityLabel('CUSTOM', 'Driver notified dispatch'), 'Driver notified dispatch');
});

test('no disabled placeholder Chat/More in driver route sheet', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/driver/DriverRouteSheet.tsx'), 'utf8');
  assert.ok(!src.includes('Chat coming soon'));
  assert.ok(!src.includes('More actions'));
  assert.ok(src.includes('TripChatDrawer'));
  assert.ok(src.includes('DriverTripMoreMenu'));
});

test('parent trips page has chat without driver components', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/trips/page.tsx'), 'utf8');
  assert.ok(src.includes('TripChatDrawer'));
  assert.ok(src.includes('Message driver'));
  assert.ok(src.includes('DriverRouteSheet'));
  assert.ok(src.includes("userRole === 'DRIVER'"));
});
