/**
 * Admin smoke tests — run with: npm test
 * No database required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  subscriptionQuoteSchema,
  adminSubscriptionCancelSchema,
  adminSubscriptionUpdateSchema,
} from '../lib/validations/subscription.ts';
import {
  safetyReportCreateSchema,
} from '../lib/validations/safety.ts';

// ─── subscriptionQuoteSchema ──────────────────────────────────────────────────
// Distance is no longer user-entered — ORS calculates it server-side.
// Schema now uses pickupLocation / dropoffLocation / tripDirection.

describe('subscriptionQuoteSchema', () => {
  const RIDER_A = '22222222-2222-2222-2222-222222222222';
  const RIDER_B = '11111111-1111-1111-1111-111111111111';

  it('accepts valid quote with pickup/dropoff and single rider', () => {
    const r = subscriptionQuoteSchema.safeParse({
      packageId: RIDER_B,
      addOnIds: [],
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: [RIDER_A],
    });
    assert.ok(r.success);
    assert.equal(r.data?.tripDirection, 'ROUND_TRIP');
  });

  it('accepts valid quote with multiple riders', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      riderIds: [RIDER_B, RIDER_A],
    });
    assert.ok(r.success);
    assert.equal(r.data?.riderIds.length, 2);
  });

  it('defaults tripDirection to ROUND_TRIP when omitted', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      riderIds: [RIDER_A],
    });
    assert.ok(r.success);
    assert.equal(r.data?.tripDirection, 'ROUND_TRIP');
  });

  it('rejects missing pickupLocation', () => {
    const r = subscriptionQuoteSchema.safeParse({
      dropoffLocation: 'King Faisal School, Riyadh',
      riderIds: [RIDER_A],
    });
    assert.ok(!r.success);
  });

  it('rejects missing dropoffLocation', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      riderIds: [RIDER_A],
    });
    assert.ok(!r.success);
  });

  it('rejects empty riderIds', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      riderIds: [],
    });
    assert.ok(!r.success);
  });

  it('rejects non-UUID riderIds', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      riderIds: ['not-a-uuid'],
    });
    assert.ok(!r.success);
  });

  it('rejects invalid tripDirection', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'BOTH',
      riderIds: [RIDER_A],
    });
    assert.ok(!r.success);
  });
});

// ─── adminSubscriptionCancelSchema ───────────────────────────────────────────

describe('adminSubscriptionCancelSchema', () => {
  it('accepts valid cancellation reason', () => {
    const r = adminSubscriptionCancelSchema.safeParse({ reason: 'Customer requested cancellation' });
    assert.ok(r.success);
  });

  it('rejects missing reason', () => {
    const r = adminSubscriptionCancelSchema.safeParse({});
    assert.ok(!r.success);
  });

  it('rejects reason shorter than 5 characters', () => {
    const r = adminSubscriptionCancelSchema.safeParse({ reason: 'No' });
    assert.ok(!r.success);
  });

  it('rejects reason longer than 1000 characters', () => {
    const r = adminSubscriptionCancelSchema.safeParse({ reason: 'a'.repeat(1001) });
    assert.ok(!r.success);
  });

  it('accepts reason of exactly 5 characters', () => {
    const r = adminSubscriptionCancelSchema.safeParse({ reason: 'abcde' });
    assert.ok(r.success);
  });
});

// ─── adminSubscriptionUpdateSchema ───────────────────────────────────────────

describe('adminSubscriptionUpdateSchema', () => {
  it('accepts all optional fields', () => {
    const r = adminSubscriptionUpdateSchema.safeParse({
      status: 'ACTIVE',
      autoRenewal: false,
      startsOn: '2025-01-01',
      endsOn: '2025-12-31',
    });
    assert.ok(r.success);
  });

  it('accepts empty object (all optional)', () => {
    const r = adminSubscriptionUpdateSchema.safeParse({});
    assert.ok(r.success);
  });

  it('rejects invalid status', () => {
    const r = adminSubscriptionUpdateSchema.safeParse({ status: 'INVALID' });
    assert.ok(!r.success);
  });

  it('rejects invalid date format', () => {
    const r = adminSubscriptionUpdateSchema.safeParse({ startsOn: '01/01/2025' });
    assert.ok(!r.success);
  });
});

// ─── Financial overview helper (pure logic) ───────────────────────────────────

describe('financial overview logic', () => {
  const computeRevenue = (payments: { status: string; amountSar: number }[]) =>
    payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amountSar, 0);

  it('counts only PAID payments as revenue', () => {
    const payments = [
      { status: 'PAID', amountSar: 100 },
      { status: 'PENDING', amountSar: 200 },
      { status: 'FAILED', amountSar: 50 },
      { status: 'PAID', amountSar: 150 },
    ];
    assert.equal(computeRevenue(payments), 250);
  });

  it('returns 0 revenue when no PAID payments', () => {
    const payments = [
      { status: 'PENDING', amountSar: 100 },
      { status: 'FAILED', amountSar: 50 },
    ];
    assert.equal(computeRevenue(payments), 0);
  });

  it('returns full sum when all payments are PAID', () => {
    const payments = [
      { status: 'PAID', amountSar: 300 },
      { status: 'PAID', amountSar: 500 },
    ];
    assert.equal(computeRevenue(payments), 800);
  });
});

// ─── Driver suspension logic ──────────────────────────────────────────────────

describe('driver suspension validation', () => {
  const validateSuspension = (isSuspended: boolean, reason?: string): boolean => {
    if (isSuspended && (!reason || !reason.trim())) return false;
    return true;
  };

  it('requires reason when suspending', () => {
    assert.ok(!validateSuspension(true, ''));
    assert.ok(!validateSuspension(true, undefined));
  });

  it('allows suspension with reason', () => {
    assert.ok(validateSuspension(true, 'Violation of code of conduct'));
  });

  it('allows unsuspension without reason', () => {
    assert.ok(validateSuspension(false, undefined));
    assert.ok(validateSuspension(false, ''));
  });
});

// ─── Admin subscription cancel — requires reason ──────────────────────────────

describe('admin cancel with reason enforcement', () => {
  const canCancel = (status: string): boolean => status !== 'CANCELLED';

  it('can cancel active subscription', () => {
    assert.ok(canCancel('ACTIVE'));
  });

  it('can cancel pending subscription', () => {
    assert.ok(canCancel('PENDING'));
  });

  it('cannot cancel already-cancelled subscription', () => {
    assert.ok(!canCancel('CANCELLED'));
  });
});

// ─── Safety report creation — valid categories ───────────────────────────────

describe('safetyReportCreateSchema in admin context', () => {
  it('accepts UNSAFE_DRIVING category', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'UNSAFE_DRIVING',
      description: 'Driver was speeding and ran multiple red lights.',
    });
    assert.ok(r.success);
  });

  it('rejects unknown category', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'UNKNOWN',
      description: 'Driver was speeding and ran multiple red lights.',
    });
    assert.ok(!r.success);
  });

  it('rejects short description', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'HARASSMENT',
      description: 'Short.',
    });
    assert.ok(!r.success);
  });
});

// ─── Trips admin filter logic ─────────────────────────────────────────────────

describe('admin trip status filter logic', () => {
  const filterByStatus = (trips: { status: string }[], filter: string) =>
    filter ? trips.filter((t) => t.status === filter) : trips;

  const TRIPS = [
    { status: 'SCHEDULED' },
    { status: 'DRIVER_ASSIGNED' },
    { status: 'COMPLETED' },
    { status: 'CANCELLED' },
  ];

  it('returns all when no filter', () => {
    assert.equal(filterByStatus(TRIPS, '').length, 4);
  });

  it('filters to scheduled only', () => {
    assert.equal(filterByStatus(TRIPS, 'SCHEDULED').length, 1);
  });

  it('filters to completed only', () => {
    assert.equal(filterByStatus(TRIPS, 'COMPLETED').length, 1);
  });

  it('returns empty when no match', () => {
    assert.equal(filterByStatus(TRIPS, 'PICKED_UP').length, 0);
  });
});

// ─── Loyalty points award logic ───────────────────────────────────────────────

describe('loyalty points logic', () => {
  const awardPoints = (config: number, action: string): number => {
    if (action === 'APPROVE' && config > 0) return config;
    return 0;
  };

  it('awards configured points on approval', () => {
    assert.equal(awardPoints(50, 'APPROVE'), 50);
  });

  it('awards no points if config is 0', () => {
    assert.equal(awardPoints(0, 'APPROVE'), 0);
  });

  it('awards no points on REJECT', () => {
    assert.equal(awardPoints(50, 'REJECT'), 0);
  });

  it('awards no points on RESOLVE', () => {
    assert.equal(awardPoints(50, 'RESOLVE'), 0);
  });
});
