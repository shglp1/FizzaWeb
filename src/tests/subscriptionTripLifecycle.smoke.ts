/**
 * Subscription ↔ trip lifecycle smoke tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOperationalSubscriptionStatus,
  isHistoricalTripListFilter,
  buildParentTripScope,
  OPERATIONAL_SUBSCRIPTION_STATUSES,
} from '../lib/subscriptions/subscriptionTripLifecycle.ts';

test('only ACTIVE subscriptions are operational', () => {
  assert.equal(isOperationalSubscriptionStatus('ACTIVE'), true);
  assert.equal(isOperationalSubscriptionStatus('CANCELLED'), false);
  assert.equal(isOperationalSubscriptionStatus('PENDING'), false);
  assert.deepEqual(OPERATIONAL_SUBSCRIPTION_STATUSES, ['ACTIVE']);
});

test('historical filters include completed and cancelled tabs', () => {
  assert.equal(isHistoricalTripListFilter('completed'), true);
  assert.equal(isHistoricalTripListFilter('cancelled'), true);
  assert.equal(isHistoricalTripListFilter('upcoming'), false);
});

test('parent operational scope uses active subscription ids only', () => {
  const scope = buildParentTripScope({
    activeSubscriptionIds: ['active-1'],
    allSubscriptionIds: ['active-1', 'cancelled-2'],
    riderIds: [],
    statusFilter: 'upcoming',
  });
  assert.ok(JSON.stringify(scope).includes('active-1'));
  assert.ok(!JSON.stringify(scope).includes('cancelled-2'));
});

test('parent historical scope includes all subscription ids', () => {
  const scope = buildParentTripScope({
    activeSubscriptionIds: ['active-1'],
    allSubscriptionIds: ['active-1', 'cancelled-2'],
    riderIds: [],
    statusFilter: 'completed',
  });
  const json = JSON.stringify(scope);
  assert.ok(json.includes('active-1'));
  assert.ok(json.includes('cancelled-2'));
});

test('empty parent scope matches nothing', () => {
  const scope = buildParentTripScope({
    activeSubscriptionIds: [],
    allSubscriptionIds: [],
    riderIds: [],
    statusFilter: 'upcoming',
  });
  assert.deepEqual(scope, { id: { in: [] } });
});
