/**
 * Task 19 — Parent tracking frontend smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { resolveParentTrackingState, buildParentSafetyTimeline } from '../lib/parent/parentTrackingState.ts';
import { headlineForState, getParentTrackingCopy } from '../lib/parent/parentTrackingCopy.ts';
import { legLocationLabels, formatLastUpdated } from '../lib/parent/parentTrackingFormatters.ts';
import { parentTrackingHeadline, trackingAvailabilityLabel } from '../lib/parent/parentFormatters.ts';
import { applyLocationPollUpdate } from '../lib/tracking/locationPollState.ts';
import { ROUTE_GEOMETRY_FALLBACK_LABEL } from '../lib/ui/driverPortal.ts';

const now = Date.parse('2026-05-24T06:00:00.000Z');
const pickupSoon = new Date(now + 20 * 60_000).toISOString();
const pickupPast = new Date(now - 5 * 60_000).toISOString();

const baseLocation = { lat: 24.7, lng: 46.7, recordedAt: new Date(now).toISOString(), stale: false };

test('no driver → driver_not_assigned', () => {
  const state = resolveParentTrackingState({
    status: 'DRIVER_ASSIGNED',
    hasDriver: false,
    location: null,
    scheduledPickupTime: pickupSoon,
    nowMs: now,
  });
  assert.equal(state.id, 'driver_not_assigned');
  assert.equal(state.showDriverMarker, false);
});

test('waiting for tracking window', () => {
  const state = resolveParentTrackingState({
    status: 'DRIVER_ASSIGNED',
    hasDriver: true,
    location: null,
    scheduledPickupTime: pickupSoon,
    nowMs: now,
  });
  assert.equal(state.id, 'waiting_for_window');
});

test('stale GPS → gps_outdated', () => {
  const state = resolveParentTrackingState({
    status: 'ON_THE_WAY',
    hasDriver: true,
    location: { ...baseLocation, stale: true },
    scheduledPickupTime: pickupPast,
    pickupLat: 24.71,
    pickupLng: 46.71,
    nowMs: now,
  });
  assert.equal(state.id, 'gps_outdated');
  assert.equal(state.showDriverMarker, true);
});

test('COMPLETED → trip_completed without live ETA emphasis', () => {
  const state = resolveParentTrackingState({
    status: 'COMPLETED',
    hasDriver: true,
    location: baseLocation,
    scheduledPickupTime: pickupPast,
    actualDropoffTime: pickupPast,
    nowMs: now,
  });
  assert.equal(state.id, 'trip_completed');
  assert.equal(state.showLiveMap, false);
  assert.equal(headlineForState(state.id), 'Trip completed — arrived safely');
});

test('actualPickupTime surfaces picked up confirmation in timeline', () => {
  const steps = buildParentSafetyTimeline({
    status: 'PICKED_UP',
    legType: 'OUTBOUND',
    actualPickupTime: pickupPast,
    actualDropoffTime: null,
  });
  const pickupStep = steps.find((s) => s.key === 'pickup');
  assert.ok(pickupStep?.done);
  assert.equal(pickupStep?.time, pickupPast);
});

test('OUTBOUND vs RETURN leg labels', () => {
  const outbound = legLocationLabels('OUTBOUND');
  assert.equal(outbound.dropoffShort, 'School');
  assert.equal(outbound.pickupShort, 'Home');
  const ret = legLocationLabels('RETURN');
  assert.equal(ret.pickupShort, 'School');
  assert.equal(ret.dropoffShort, 'Home');
});

test('parent copy does not expose raw enum names', () => {
  const copy = getParentTrackingCopy('en');
  const headlines = [
    headlineForState('driver_en_route_to_pickup'),
    headlineForState('en_route_to_school'),
    headlineForState('student_picked_up'),
    headlineForState('waiting_for_window'),
  ];
  for (const h of headlines) {
    assert.ok(!h.includes('ON_THE_WAY'));
    assert.ok(!h.includes('EN_ROUTE'));
    assert.ok(!h.includes('DRIVER_ASSIGNED'));
  }
  assert.match(copy.liveEtaUnavailable, /unavailable/i);
});

test('formatLastUpdated uses recordedAt not poll time', () => {
  const twoMinAgo = new Date(now - 2 * 60_000).toISOString();
  assert.equal(formatLastUpdated(twoMinAgo, now), '2 min ago');
});

test('dashboard headline uses parent resolver', () => {
  const headline = parentTrackingHeadline({
    status: 'COMPLETED',
    legType: 'OUTBOUND',
    driver: { id: 'd1' },
    scheduledPickupTime: pickupPast,
    actualDropoffTime: pickupPast,
  });
  assert.match(headline, /safely|completed/i);
});

test('tracking availability labels align with parent copy', () => {
  assert.match(trackingAvailabilityLabel('available'), /Live location/i);
  assert.match(trackingAvailabilityLabel('unassigned'), /not assigned/i);
});

test('route geometry fallback label present for map UI', () => {
  assert.match(ROUTE_GEOMETRY_FALLBACK_LABEL, /approximate route/i);
});

test('ParentTrackingView module exists and branches from tracking page', () => {
  const page = readFileSync(join(process.cwd(), 'src/app/tracking/[tripId]/page.tsx'), 'utf8');
  assert.ok(page.includes('ParentTrackingView'));
  assert.ok(page.includes('DriverTrackingView'));
  assert.ok(page.includes('useTripTracking'));
  assert.ok(page.includes('TrackingPageLoading'));
  assert.ok(page.includes('roleKnown'));
  assert.ok(!page.includes('ParentTrackingLoading'));
});

test('TripTrackingMap uses mapTiles and marker helpers', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/tracking/TripTrackingMap.tsx'), 'utf8');
  assert.ok(src.includes('getMapTileLayer'));
  assert.ok(src.includes('trackingMarkerHtml'));
  assert.ok(src.includes('pickupLabel'));
});

test('resolveEtaTarget for pickup vs dropoff legs', async () => {
  const { resolveEtaTarget } = await import('../lib/trips/tripEta.ts');
  assert.equal(resolveEtaTarget('ON_THE_WAY'), 'pickup');
  assert.equal(resolveEtaTarget('EN_ROUTE_DROPOFF'), 'dropoff');
  assert.equal(resolveEtaTarget('COMPLETED'), null);
});

test('liveEta cache throttles ORS compute to once per 60s per trip', async () => {
  const { getOrComputeLiveEta, clearLiveEtaCache, LIVE_ETA_CACHE_TTL_MS } = await import('../lib/tracking/liveEtaCache.ts');
  clearLiveEtaCache();
  const now = Date.now();
  let computeCalls = 0;
  const compute = async () => {
    computeCalls += 1;
    return { liveEtaMinutes: 8, etaTarget: 'pickup' as const, etaSource: 'FALLBACK' as const };
  };

  await getOrComputeLiveEta('trip-1', compute, { nowMs: now });
  await getOrComputeLiveEta('trip-1', compute, { nowMs: now + 15_000 });
  await getOrComputeLiveEta('trip-1', compute, { nowMs: now + 30_000 });
  assert.equal(computeCalls, 1);

  await getOrComputeLiveEta('trip-1', compute, { nowMs: now + LIVE_ETA_CACHE_TTL_MS + 1 });
  assert.equal(computeCalls, 2);
  clearLiveEtaCache();
});

test('location poll route does not call ORS ETA on every request', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/tracking/[tripId]/location/route.ts'), 'utf8');
  assert.ok(!src.includes('calculateLiveEtaForTrip'));
  assert.ok(!src.includes('getTripOpsConfig'));
  assert.ok(src.includes('getCachedLiveEta'));
});

test('applyLocationPollUpdate clears driver marker when trip becomes terminal', () => {
  const trip = {
    id: 't1',
    status: 'ON_THE_WAY',
    scheduledPickupTime: pickupPast,
    scheduledDropoffTime: null,
    scheduledDate: pickupPast,
    statusReason: null,
    actualPickupTime: null,
    actualDropoffTime: null,
    pickupLocation: 'Home',
    dropoffLocation: 'School',
    pickupLat: 1,
    pickupLng: 2,
    dropoffLat: 3,
    dropoffLng: 4,
    rider: null,
    driver: null,
    vehicle: null,
    events: [],
  };
  const update = applyLocationPollUpdate(trip, {
    location: null,
    terminal: true,
    trackingVisible: false,
    tripStatus: 'COMPLETED',
  });
  assert.equal(update.location, null);
  assert.equal(update.stopPolling, true);
  assert.equal(update.trip?.status, 'COMPLETED');
});

test('applyLocationPollUpdate clears ghost marker when location is null while visible', () => {
  const trip = {
    id: 't1',
    status: 'ON_THE_WAY',
    scheduledPickupTime: pickupPast,
    scheduledDropoffTime: null,
    scheduledDate: pickupPast,
    statusReason: null,
    actualPickupTime: null,
    actualDropoffTime: null,
    pickupLocation: 'Home',
    dropoffLocation: 'School',
    pickupLat: 1,
    pickupLng: 2,
    dropoffLat: 3,
    dropoffLng: 4,
    rider: null,
    driver: null,
    vehicle: null,
    events: [],
  };
  const update = applyLocationPollUpdate(trip, {
    location: null,
    trackingVisible: true,
    terminal: false,
    tripStatus: 'ON_THE_WAY',
  });
  assert.equal(update.location, null);
});

test('applyLocationPollUpdate clears marker before tracking window', () => {
  const trip = {
    id: 't1',
    status: 'DRIVER_ASSIGNED',
    scheduledPickupTime: pickupSoon,
    scheduledDropoffTime: null,
    scheduledDate: pickupSoon,
    statusReason: null,
    actualPickupTime: null,
    actualDropoffTime: null,
    pickupLocation: 'Home',
    dropoffLocation: 'School',
    pickupLat: 1,
    pickupLng: 2,
    dropoffLat: 3,
    dropoffLng: 4,
    rider: null,
    driver: null,
    vehicle: null,
    events: [],
  };
  const update = applyLocationPollUpdate(trip, {
    location: null,
    tooEarly: true,
    trackingVisible: false,
    terminal: false,
    tripStatus: 'DRIVER_ASSIGNED',
  });
  assert.equal(update.location, null);
  assert.equal(update.tooEarly, true);
});

test('stale GPS remains visible but flagged via location snapshot', () => {
  const trip = {
    id: 't1',
    status: 'ON_THE_WAY',
    scheduledPickupTime: pickupPast,
    scheduledDropoffTime: null,
    scheduledDate: pickupPast,
    statusReason: null,
    actualPickupTime: null,
    actualDropoffTime: null,
    pickupLocation: 'Home',
    dropoffLocation: 'School',
    pickupLat: 1,
    pickupLng: 2,
    dropoffLat: 3,
    dropoffLng: 4,
    rider: null,
    driver: null,
    vehicle: null,
    events: [],
  };
  const update = applyLocationPollUpdate(trip, {
    location: { lat: 24.7, lng: 46.7, recordedAt: pickupPast, stale: true },
    trackingVisible: true,
    terminal: false,
    tripStatus: 'ON_THE_WAY',
  });
  assert.equal(update.location?.stale, true);
});

test('driver tracking view remains wired on tracking page', () => {
  const page = readFileSync(join(process.cwd(), 'src/app/tracking/[tripId]/page.tsx'), 'utf8');
  const driverView = readFileSync(join(process.cwd(), 'src/components/driver/DriverTrackingView.tsx'), 'utf8');
  assert.ok(page.includes('DriverTrackingView'));
  assert.ok(driverView.includes('DriverGpsPanel'));
  assert.ok(driverView.includes('requestStatusAdvance'));
  assert.ok(driverView.includes('DriverStatusConfirmDialog'));
  assert.ok(driverView.includes('requestNoShow'));
  assert.match(driverView, /ARRIVED_PICKUP/);
});
