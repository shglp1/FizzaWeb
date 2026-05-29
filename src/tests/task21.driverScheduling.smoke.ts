/**
 * Driver scheduling / Asia-Riyadh timezone smoke tests (Task 21).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBusinessDateKey,
  getBusinessDayRange,
  getTripBusinessDateKey,
  isSameBusinessDay,
  isTripStaleNonTerminal,
  parseBusinessLocalTime,
} from '../lib/time/businessTimezone.ts';
import {
  partitionStaleTrips,
  resolveDriverHeroTrip,
} from '../lib/ui/driverTripSelection.ts';
import {
  getTrackingAvailability,
  groupTripsByTrackingAvailability,
} from '../lib/ui/driverPortal.ts';

const DRIVER = 'driver-1';
const may29 = '2026-05-29';
const may24 = '2026-05-24';
const may25 = '2026-05-25';
const may30 = '2026-05-30';

/** May 29 2026 10:00 Asia/Riyadh */
const nowMay29Ms = new Date(`${may29}T07:00:00.000Z`).getTime();

function trip(
  id: string,
  overrides: Partial<{
    status: string;
    scheduledDate: string;
    scheduledPickupTime: string | null;
    driverId: string | null;
  }>,
) {
  return {
    id,
    status: 'DRIVER_ASSIGNED',
    scheduledDate: may29,
    scheduledPickupTime: `${may29}T04:10:00.000Z`,
    driverId: DRIVER,
    ...overrides,
  };
}

test('May 29 Riyadh today excludes May 24/25 old trips from normal partition', () => {
  const trips = [
    trip('old-24', { scheduledDate: may24, scheduledPickupTime: `${may24}T04:10:00.000Z` }),
    trip('old-25', { scheduledDate: may25, scheduledPickupTime: `${may25}T04:10:00.000Z`, status: 'PRE_TRIP' }),
    trip('today', { scheduledPickupTime: `${may29}T15:00:00.000Z` }),
  ];
  const { normal, stale } = partitionStaleTrips(trips, nowMay29Ms);
  assert.equal(normal.length, 1);
  assert.equal(normal[0]!.id, 'today');
  assert.equal(stale.length, 2);
  assert.ok(stale.some((t) => t.id === 'old-24'));
  assert.ok(stale.some((t) => t.id === 'old-25'));
});

test('May 24 DRIVER_ASSIGNED is needs_review not opens_soon', () => {
  const avail = getTrackingAvailability({
    status: 'DRIVER_ASSIGNED',
    scheduledDate: may24,
    scheduledPickupTime: `${may24}T04:10:00.000Z`,
    nowMs: nowMay29Ms,
  });
  assert.equal(avail.availability, 'needs_review');
  assert.equal(avail.group, 'needs_review');
  assert.notEqual(avail.group, 'opens_soon');
});

test('hero picks remaining today before tomorrow', () => {
  const trips = [
    trip('past-today', { scheduledPickupTime: `${may29}T04:00:00.000Z` }),
    trip('later-today', { scheduledPickupTime: `${may29}T15:00:00.000Z` }),
    trip('tomorrow', { scheduledDate: may30, scheduledPickupTime: `${may30}T04:10:00.000Z` }),
  ];
  const hero = resolveDriverHeroTrip(trips, nowMay29Ms, DRIVER);
  assert.equal(hero?.trip.id, 'later-today');
  assert.equal(hero?.kind, 'today');
});

test('when today has no remaining trips tomorrow is upcoming not today hero', () => {
  const nowMs = new Date(`${may29}T18:00:00.000Z`).getTime();
  const trips = [
    trip('past-today', { scheduledPickupTime: `${may29}T04:00:00.000Z` }),
    trip('tomorrow', { scheduledDate: may30, scheduledPickupTime: `${may30}T04:10:00.000Z` }),
  ];
  const hero = resolveDriverHeroTrip(trips, nowMs, DRIVER);
  assert.equal(hero?.trip.id, 'tomorrow');
  assert.equal(hero?.kind, 'upcoming');
});

test('active trip from earlier today still appears in hero', () => {
  const trips = [
    trip('active', {
      status: 'ON_THE_WAY',
      scheduledPickupTime: `${may29}T04:10:00.000Z`,
    }),
    trip('later', { scheduledPickupTime: `${may29}T15:00:00.000Z` }),
  ];
  const hero = resolveDriverHeroTrip(trips, nowMay29Ms, DRIVER);
  assert.equal(hero?.trip.id, 'active');
  assert.equal(hero?.kind, 'active');
});

test('07:10 Saudi pickup belongs to correct business day', () => {
  const pickup = parseBusinessLocalTime('07:10', may29);
  assert.equal(pickup.toISOString(), `${may29}T04:10:00.000Z`);
  const key = getTripBusinessDateKey({
    scheduledDate: may29,
    scheduledPickupTime: pickup.toISOString(),
  });
  assert.equal(key, may29);
});

test('Riyadh midnight edge: late evening vs early morning business days', () => {
  const lateMay28 = parseBusinessLocalTime('23:30', '2026-05-28');
  const earlyMay29 = parseBusinessLocalTime('00:30', may29);
  assert.equal(getBusinessDateKey(lateMay28), '2026-05-28');
  assert.equal(getBusinessDateKey(earlyMay29), may29);
  assert.equal(isSameBusinessDay(lateMay28, '2026-05-28'), true);
  assert.equal(isSameBusinessDay(earlyMay29, may29), true);
  assert.equal(isSameBusinessDay(lateMay28, earlyMay29), false);
});

test('getBusinessDayRange covers full Riyadh calendar day', () => {
  const { startMs, endMs } = getBusinessDayRange(may29);
  assert.equal(new Date(startMs).toISOString(), '2026-05-28T21:00:00.000Z');
  const startKey = getBusinessDateKey(new Date(startMs));
  const endKey = getBusinessDateKey(new Date(endMs));
  assert.equal(startKey, may29);
  assert.equal(endKey, may29);
});

test('tracking grouping puts stale old trips in needs_review not opens_soon', () => {
  const groups = groupTripsByTrackingAvailability(
    [
      {
        status: 'DRIVER_ASSIGNED',
        scheduledDate: may24,
        scheduledPickupTime: `${may24}T04:10:00.000Z`,
      },
      {
        status: 'DRIVER_ASSIGNED',
        scheduledDate: may29,
        scheduledPickupTime: `${may29}T20:00:00.000Z`,
      },
    ],
    nowMay29Ms,
  );
  assert.equal(groups.needs_review.length, 1);
  assert.equal(groups.opens_soon.length, 1);
  assert.equal(groups.needs_review[0]!.scheduledDate, may24);
});

test('stale active trip from previous day is flagged stale', () => {
  assert.equal(
    isTripStaleNonTerminal(
      {
        status: 'ON_THE_WAY',
        scheduledDate: may24,
        scheduledPickupTime: `${may24}T04:10:00.000Z`,
      },
      nowMay29Ms,
    ),
    true,
  );
});
