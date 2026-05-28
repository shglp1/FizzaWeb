/**
 * Driver next-trip selection and assignment display smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  computeDriverTripCounts,
  explainNextTripExclusion,
  filterDriverAssignedTrips,
  filterTripsForLocalDate,
  getTimezoneDateKey,
  isDriverNextTripCandidate,
  pickNextDriverTrip,
  resolveTripStartMs,
} from '../lib/ui/driverTripSelection.ts';
import { getDriverPrimaryAction, minutesUntilPickup } from '../lib/ui/driverPortal.ts';

const DRIVER = 'driver-1';
const today = '2026-05-26';
const tomorrow = '2026-05-27';

function trip(id: string, overrides: Partial<{
  status: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  driverId: string | null;
}>) {
  return {
    id,
    status: 'DRIVER_ASSIGNED',
    scheduledDate: today,
    scheduledPickupTime: `${today}T07:00:00.000Z`,
    driverId: DRIVER,
    ...overrides,
  };
}

test('next trip skips passed today pickup and selects later today trip', () => {
  const nowMs = new Date(`${today}T10:00:00.000Z`).getTime();
  const trips = [
    trip('past', { scheduledPickupTime: `${today}T04:00:00.000Z` }),
    trip('later', { scheduledPickupTime: `${today}T15:00:00.000Z` }),
  ];
  const next = pickNextDriverTrip(trips, nowMs, DRIVER);
  assert.equal(next?.id, 'later');
  assert.equal(explainNextTripExclusion(trips[0]!, nowMs, DRIVER), 'past_pickup');
});

test('when all today trips passed, next trip is tomorrow first assigned trip', () => {
  const nowMs = new Date(`${today}T18:00:00.000Z`).getTime();
  const trips = [
    trip('today-past', { scheduledPickupTime: `${today}T04:00:00.000Z` }),
    trip('tomorrow-first', { scheduledDate: tomorrow, scheduledPickupTime: `${tomorrow}T07:00:00.000Z` }),
    trip('tomorrow-second', { scheduledDate: tomorrow, scheduledPickupTime: `${tomorrow}T15:00:00.000Z` }),
  ];
  const next = pickNextDriverTrip(trips, nowMs, DRIVER);
  assert.equal(next?.id, 'tomorrow-first');
});

test('completed and cancelled trips are excluded from next trip', () => {
  const nowMs = new Date(`${today}T06:00:00.000Z`).getTime();
  const trips = [
    trip('done', { status: 'COMPLETED' }),
    trip('cancelled', { status: 'CANCELLED', scheduledPickupTime: `${today}T08:00:00.000Z` }),
    trip('future', { scheduledPickupTime: `${today}T09:00:00.000Z` }),
  ];
  const next = pickNextDriverTrip(trips, nowMs, DRIVER);
  assert.equal(next?.id, 'future');
});

test('trips not assigned to current driver are excluded', () => {
  const nowMs = new Date(`${today}T06:00:00.000Z`).getTime();
  const trips = [
    trip('other', { driverId: 'driver-2', scheduledPickupTime: `${today}T07:00:00.000Z` }),
    trip('mine', { scheduledPickupTime: `${today}T09:00:00.000Z` }),
  ];
  const next = pickNextDriverTrip(trips, nowMs, DRIVER);
  assert.equal(next?.id, 'mine');
  assert.equal(filterDriverAssignedTrips(trips, DRIVER).length, 1);
});

test('date + time comparison uses scheduledPickupTime not time strings alone', () => {
  const a = resolveTripStartMs({ scheduledDate: today, scheduledPickupTime: `${today}T07:00:00.000Z` });
  const b = resolveTripStartMs({ scheduledDate: today, scheduledPickupTime: `${today}T15:00:00.000Z` });
  assert.ok(a! < b!);
  const mins = minutesUntilPickup(`${today}T15:00:00.000Z`, new Date(`${today}T10:00:00.000Z`).getTime());
  assert.equal(mins, 300);
});

test('assigned SCHEDULED trip uses driver GPS message not admin assignment message', () => {
  const action = getDriverPrimaryAction('SCHEDULED', false, { isAssignedToCurrentDriver: true });
  assert.equal(action.disabledReason, 'GPS opens 10 minutes before pickup.');
  assert.notEqual(action.disabledReason, 'Admin has not assigned you yet.');
});

test('unassigned SCHEDULED trip keeps admin assignment message outside driver portal', () => {
  const action = getDriverPrimaryAction('SCHEDULED', false);
  assert.equal(action.disabledReason, 'Admin has not assigned you yet.');
});

test('driver route sheet does not show admin assignment message for assigned trips', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/driver/DriverRouteSheet.tsx'), 'utf8');
  assert.match(src, /isAssignedToCurrentDriver:\s*true/);
  assert.doesNotMatch(src, /trip\.status === 'SCHEDULED' \? 'dispatch'/);
});

test('today total and remaining counts use assigned trips only', () => {
  const nowMs = new Date(`${today}T10:00:00.000Z`).getTime();
  const now = new Date(nowMs);
  const todayKey = getTimezoneDateKey(now, 'Asia/Riyadh');
  const trips = [
    trip('past', { scheduledPickupTime: `${today}T04:00:00.000Z` }),
    trip('future', { scheduledPickupTime: `${today}T15:00:00.000Z` }),
    trip('done', { status: 'COMPLETED', scheduledPickupTime: `${today}T05:00:00.000Z` }),
    trip('other-driver', { driverId: 'driver-2', scheduledPickupTime: `${today}T16:00:00.000Z` }),
  ];
  const counts = computeDriverTripCounts(trips, nowMs, now, 'Asia/Riyadh', DRIVER);
  assert.equal(counts.todayTotal, 3);
  assert.equal(counts.completedToday, 1);
  assert.equal(counts.remainingToday, 1);
  assert.equal(counts.upcoming, 1);
  assert.equal(filterTripsForLocalDate(filterDriverAssignedTrips(trips, DRIVER), todayKey).length, 3);
});

test('isDriverNextTripCandidate excludes past pickup for upcoming statuses', () => {
  const nowMs = new Date(`${today}T10:00:00.000Z`).getTime();
  assert.equal(
    isDriverNextTripCandidate(trip('x', { scheduledPickupTime: `${today}T04:00:00.000Z` }), nowMs, DRIVER),
    false,
  );
  assert.equal(
    isDriverNextTripCandidate(trip('y', { scheduledPickupTime: `${today}T15:00:00.000Z` }), nowMs, DRIVER),
    true,
  );
});
