/**
 * Trip API filter smoke tests — pagination/classification consistency.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTripsForRoleApi } from '../lib/trips/tripApiFilters.ts';

// Use dynamic "today" and "6 days ago" so these tests stay green regardless of the run date.
const today = new Date();
const todayStr = today.toISOString().slice(0, 10);

const sixDaysAgo = new Date(today);
sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
const staleDateStr = sixDaysAgo.toISOString().slice(0, 10);

function mk(overrides: Partial<{ id: string; status: string; scheduledDate: string; scheduledPickupTime: string | null }>) {
  return {
    id: overrides.id ?? 't1',
    status: overrides.status ?? 'DRIVER_ASSIGNED',
    scheduledDate: overrides.scheduledDate ?? todayStr,
    scheduledPickupTime: overrides.scheduledPickupTime ?? `${todayStr}T15:00:00.000Z`,
  };
}

test('upcoming excludes stale past-date trips', () => {
  const trips = [
    mk({ id: 'stale', scheduledDate: staleDateStr, scheduledPickupTime: `${staleDateStr}T04:10:00.000Z` }),
    mk({ id: 'ok', scheduledPickupTime: `${todayStr}T15:00:00.000Z` }),
  ];
  const filtered = filterTripsForRoleApi(trips, { role: 'PARENT', statusFilter: 'upcoming' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.id, 'ok');
});

test('review filter includes stale non-terminal', () => {
  const trips = [
    mk({ id: 'stale', scheduledDate: staleDateStr, scheduledPickupTime: `${staleDateStr}T04:10:00.000Z` }),
    mk({ id: 'ok', scheduledPickupTime: `${todayStr}T15:00:00.000Z` }),
  ];
  const filtered = filterTripsForRoleApi(trips, { role: 'PARENT', statusFilter: 'review' });
  assert.ok(filtered.some((t) => t.id === 'stale'));
});

test('pagination slice preserves totals when filtering in memory', () => {
  const trips = Array.from({ length: 5 }, (_, i) =>
    mk({ id: `t${i}`, scheduledPickupTime: `${todayStr}T${10 + i}:00:00.000Z` }),
  );
  trips.push(mk({ id: 'stale', scheduledDate: staleDateStr, scheduledPickupTime: `${staleDateStr}T04:10:00.000Z` }));
  const filtered = filterTripsForRoleApi(trips, { role: 'PARENT', statusFilter: 'upcoming' });
  const page = filtered.slice(0, 2);
  assert.equal(filtered.length, 5);
  assert.equal(page.length, 2);
});

test('active includes same-day active status trips', () => {
  const trips = [mk({ id: 'live', status: 'ON_THE_WAY', scheduledPickupTime: `${todayStr}T08:00:00.000Z` })];
  const filtered = filterTripsForRoleApi(trips, { role: 'PARENT', statusFilter: 'active' });
  assert.equal(filtered.length, 1);
});
