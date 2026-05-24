/**
 * Safety report smoke tests — run with: npm test
 * Uses Node.js built-in test runner. No database required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  safetyReportCreateSchema,
  safetyReportUpdateSchema,
  adminSafetyReviewSchema,
  safetyListQuerySchema,
  SAFETY_CATEGORIES,
} from '../lib/validations/safety.ts';

// ─── safetyReportCreateSchema ─────────────────────────────────────────────────

describe('safetyReportCreateSchema', () => {
  const validDescription = 'The driver was speeding and ran two red lights during the trip.';

  it('accepts a valid minimal report', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'UNSAFE_DRIVING',
      description: validDescription,
    });
    assert.ok(r.success);
  });

  it('accepts a report with optional tripId', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'HARASSMENT',
      description: validDescription,
      tripId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.ok(r.success);
  });

  it('accepts a report with attachment URLs', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'VEHICLE_CONDITION',
      description: validDescription,
      attachmentUrls: ['https://example.com/photo1.jpg'],
    });
    assert.ok(r.success);
  });

  it('rejects missing category', () => {
    const r = safetyReportCreateSchema.safeParse({ description: validDescription });
    assert.ok(!r.success);
  });

  it('rejects invalid category', () => {
    const r = safetyReportCreateSchema.safeParse({ category: 'INVALID_CAT', description: validDescription });
    assert.ok(!r.success);
  });

  it('rejects description shorter than 20 characters', () => {
    const r = safetyReportCreateSchema.safeParse({ category: 'OTHER', description: 'Too short.' });
    assert.ok(!r.success);
  });

  it('rejects description exactly 19 characters', () => {
    const r = safetyReportCreateSchema.safeParse({ category: 'OTHER', description: '1234567890123456789' });
    assert.ok(!r.success);
  });

  it('accepts description exactly 20 characters', () => {
    const r = safetyReportCreateSchema.safeParse({ category: 'OTHER', description: '12345678901234567890' });
    assert.ok(r.success);
  });

  it('rejects non-uuid tripId', () => {
    const r = safetyReportCreateSchema.safeParse({ category: 'OTHER', description: validDescription, tripId: 'not-a-uuid' });
    assert.ok(!r.success);
  });

  it('rejects invalid attachment URL', () => {
    const r = safetyReportCreateSchema.safeParse({
      category: 'OTHER',
      description: validDescription,
      attachmentUrls: ['not-a-url'],
    });
    assert.ok(!r.success);
  });

  it('accepts all SAFETY_CATEGORIES values', () => {
    for (const cat of SAFETY_CATEGORIES) {
      const r = safetyReportCreateSchema.safeParse({ category: cat, description: validDescription });
      assert.ok(r.success, `Expected ${cat} to be accepted`);
    }
  });
});

// ─── safetyReportUpdateSchema ─────────────────────────────────────────────────

describe('safetyReportUpdateSchema', () => {
  it('accepts empty object (all optional)', () => {
    const r = safetyReportUpdateSchema.safeParse({});
    assert.ok(r.success);
  });

  it('accepts valid description update', () => {
    const r = safetyReportUpdateSchema.safeParse({
      description: 'Updated description that is long enough to pass validation.',
    });
    assert.ok(r.success);
  });

  it('accepts valid attachmentUrls update', () => {
    const r = safetyReportUpdateSchema.safeParse({
      attachmentUrls: ['https://example.com/new.jpg'],
    });
    assert.ok(r.success);
  });

  it('rejects description shorter than 20 chars', () => {
    const r = safetyReportUpdateSchema.safeParse({ description: 'Short' });
    assert.ok(!r.success);
  });
});

// ─── adminSafetyReviewSchema ──────────────────────────────────────────────────

describe('adminSafetyReviewSchema', () => {
  it('accepts APPROVE without adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'APPROVE' });
    assert.ok(r.success);
  });

  it('accepts APPROVE with adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'APPROVE', adminResponse: 'Verified.' });
    assert.ok(r.success);
  });

  it('accepts REJECT with adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'REJECT', adminResponse: 'Not enough evidence.' });
    assert.ok(r.success);
  });

  it('rejects REJECT without adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'REJECT' });
    assert.ok(!r.success);
  });

  it('rejects RESOLVE without adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'RESOLVE' });
    assert.ok(!r.success);
  });

  it('accepts RESOLVE with adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'RESOLVE', adminResponse: 'Driver warned.' });
    assert.ok(r.success);
  });

  it('rejects invalid action', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'DELETE' });
    assert.ok(!r.success);
  });

  it('rejects REJECT with empty string adminResponse', () => {
    const r = adminSafetyReviewSchema.safeParse({ action: 'REJECT', adminResponse: '' });
    assert.ok(!r.success);
  });
});

// ─── safetyListQuerySchema ────────────────────────────────────────────────────

describe('safetyListQuerySchema', () => {
  it('accepts empty object with defaults', () => {
    const r = safetyListQuerySchema.safeParse({});
    assert.ok(r.success);
    assert.equal(r.data?.page, 1);
    assert.equal(r.data?.limit, 10);
  });

  it('coerces page/limit from strings', () => {
    const r = safetyListQuerySchema.safeParse({ page: '2', limit: '10' });
    assert.ok(r.success);
    assert.equal(r.data?.page, 2);
    assert.equal(r.data?.limit, 10);
  });

  it('rejects limit above 50', () => {
    const r = safetyListQuerySchema.safeParse({ limit: '100' });
    assert.ok(!r.success);
  });

  it('accepts valid status filter', () => {
    const r = safetyListQuerySchema.safeParse({ status: 'PENDING' });
    assert.ok(r.success);
    assert.equal(r.data?.status, 'PENDING');
  });

  it('rejects invalid status filter', () => {
    const r = safetyListQuerySchema.safeParse({ status: 'UNKNOWN' });
    assert.ok(!r.success);
  });
});
