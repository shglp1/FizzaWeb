/**
 * Subscription validation smoke tests — run with: npm test
 * Uses Node.js built-in test runner. No database required.
 * DB-level authorization (ownership, rider scoping) is enforced server-side in the API
 * and relies on Prisma — those cases require an integration test against a live DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
} from '../lib/validations/subscription.ts';

// ─── Shared valid payload ─────────────────────────────────────────────────────

const validPayload = {
  subscriptionType: 'school' as const,
  pickupLocation: 'Al-Nakheel District, Riyadh',
  dropoffLocation: 'King Faisal School',
  pickupTime: '07:00',
  returnTime: '15:00',
  weekdays: [0, 1, 2, 3, 4],
};

// ─── subscriptionCreateSchema ─────────────────────────────────────────────────

describe('subscriptionCreateSchema', () => {
  it('accepts a minimal valid payload', () => {
    const r = subscriptionCreateSchema.safeParse(validPayload);
    assert.ok(r.success, JSON.stringify(r.error?.issues));
  });

  it('accepts a full valid payload', () => {
    const r = subscriptionCreateSchema.safeParse({
      ...validPayload,
      packageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      riderId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      offDays: [5],
      addOnIds: ['c3d4e5f6-a7b8-9012-cdef-123456789012'],
      femaleDriverPreference: true,
      autoRenewal: false,
      startsOn: '2026-09-01',
    });
    assert.ok(r.success, JSON.stringify(r.error?.issues));
  });

  it('defaults offDays to []', () => {
    const r = subscriptionCreateSchema.safeParse(validPayload);
    assert.ok(r.success);
    assert.deepEqual(r.data?.offDays, []);
  });

  it('defaults addOnIds to []', () => {
    const r = subscriptionCreateSchema.safeParse(validPayload);
    assert.ok(r.success);
    assert.deepEqual(r.data?.addOnIds, []);
  });

  it('defaults femaleDriverPreference to false', () => {
    const r = subscriptionCreateSchema.safeParse(validPayload);
    assert.ok(r.success);
    assert.equal(r.data?.femaleDriverPreference, false);
  });

  it('defaults autoRenewal to true', () => {
    const r = subscriptionCreateSchema.safeParse(validPayload);
    assert.ok(r.success);
    assert.equal(r.data?.autoRenewal, true);
  });

  it('rejects missing subscriptionType', () => {
    const { subscriptionType: _, ...rest } = validPayload;
    const r = subscriptionCreateSchema.safeParse(rest);
    assert.ok(!r.success);
  });

  it('rejects invalid subscriptionType', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, subscriptionType: 'college' });
    assert.ok(!r.success);
  });

  it('rejects pickupLocation shorter than 3 characters', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, pickupLocation: 'AB' });
    assert.ok(!r.success);
  });

  it('rejects dropoffLocation shorter than 3 characters', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, dropoffLocation: 'AB' });
    assert.ok(!r.success);
  });

  it('rejects pickupTime not in HH:MM format', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, pickupTime: '7am' });
    assert.ok(!r.success);
  });

  it('rejects returnTime not in HH:MM format', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, returnTime: '3:00pm' });
    assert.ok(!r.success);
  });

  it('rejects empty weekdays array', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, weekdays: [] });
    assert.ok(!r.success);
  });

  it('rejects weekday out of range (7)', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, weekdays: [0, 7] });
    assert.ok(!r.success);
  });

  it('rejects duplicate weekdays', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, weekdays: [0, 0, 1] });
    assert.ok(!r.success);
  });

  it('rejects invalid startsOn format', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, startsOn: '01/09/2026' });
    assert.ok(!r.success);
  });

  it('accepts valid startsOn in YYYY-MM-DD format', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, startsOn: '2026-09-01' });
    assert.ok(r.success);
  });

  it('accepts university subscriptionType', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, subscriptionType: 'university' });
    assert.ok(r.success);
  });

  it('accepts weekend-only schedule (Fri-Sat)', () => {
    const r = subscriptionCreateSchema.safeParse({ ...validPayload, weekdays: [5, 6] });
    assert.ok(r.success);
  });
});

// ─── subscriptionUpdateSchema ─────────────────────────────────────────────────

describe('subscriptionUpdateSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const r = subscriptionUpdateSchema.safeParse({});
    assert.ok(r.success);
  });

  it('accepts valid partial update', () => {
    const r = subscriptionUpdateSchema.safeParse({
      pickupLocation: 'New pickup address',
      autoRenewal: false,
    });
    assert.ok(r.success);
  });

  it('rejects pickupLocation shorter than 3 characters', () => {
    const r = subscriptionUpdateSchema.safeParse({ pickupLocation: 'AB' });
    assert.ok(!r.success);
  });

  it('rejects invalid pickupTime format', () => {
    const r = subscriptionUpdateSchema.safeParse({ pickupTime: 'seven' });
    assert.ok(!r.success);
  });

  it('rejects invalid startsOn format', () => {
    const r = subscriptionUpdateSchema.safeParse({ startsOn: '2026/09/01' });
    assert.ok(!r.success);
  });

  it('accepts valid time update', () => {
    const r = subscriptionUpdateSchema.safeParse({ pickupTime: '08:30', returnTime: '16:00' });
    assert.ok(r.success);
  });
});
