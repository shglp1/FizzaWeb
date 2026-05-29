/**
 * Validation smoke tests — run with: npm test
 * Uses Node.js built-in test runner. No database required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { profileUpdateSchema } from '../lib/validations/profile.ts';
import { riderCreateSchema, riderUpdateSchema } from '../lib/validations/rider.ts';
import { driverApplicationSchema, adminReviewSchema } from '../lib/validations/driverApplication.ts';

// ─── Profile ─────────────────────────────────────────────────────────────────

describe('profileUpdateSchema', () => {
  it('accepts a valid full update', () => {
    const r = profileUpdateSchema.safeParse({
      fullName: 'Fizza Test',
      phone: '+966512345678',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    assert.ok(r.success);
  });

  it('accepts an empty object (all fields optional)', () => {
    const r = profileUpdateSchema.safeParse({});
    assert.ok(r.success);
  });

  it('rejects fullName shorter than 2 characters', () => {
    const r = profileUpdateSchema.safeParse({ fullName: 'A' });
    assert.ok(!r.success);
  });

  it('rejects invalid avatarUrl', () => {
    const r = profileUpdateSchema.safeParse({ avatarUrl: 'not-a-url' });
    assert.ok(!r.success);
  });

  it('accepts empty string for avatarUrl (clear avatar)', () => {
    const r = profileUpdateSchema.safeParse({ avatarUrl: '' });
    assert.ok(r.success);
  });

  it('rejects phone shorter than 9 characters', () => {
    const r = profileUpdateSchema.safeParse({ phone: '1234' });
    assert.ok(!r.success);
  });
});

// ─── Rider ───────────────────────────────────────────────────────────────────

describe('riderCreateSchema', () => {
  it('accepts a valid rider', () => {
    const r = riderCreateSchema.safeParse({
      name: 'Sara',
      relationship: 'Daughter',
      school: 'Al-Manar School',
      grade: '5',
      phone: '0501234567',
      specialNeeds: false,
      notes: 'Allergic to peanuts',
    });
    assert.ok(r.success);
  });

  it('accepts minimal rider (name + relationship only)', () => {
    const r = riderCreateSchema.safeParse({ name: 'Sara', relationship: 'Daughter' });
    assert.ok(r.success);
  });

  it('rejects missing name', () => {
    const r = riderCreateSchema.safeParse({ relationship: 'Son' });
    assert.ok(!r.success);
  });

  it('rejects missing relationship', () => {
    const r = riderCreateSchema.safeParse({ name: 'Ahmed' });
    assert.ok(!r.success);
  });

  it('defaults specialNeeds to false when omitted', () => {
    const r = riderCreateSchema.safeParse({ name: 'Ahmed', relationship: 'Son' });
    assert.ok(r.success);
    assert.equal(r.data?.specialNeeds, false);
  });
});

describe('riderUpdateSchema', () => {
  it('accepts valid update with id', () => {
    const r = riderUpdateSchema.safeParse({ id: 'rider-123', name: 'Updated Name' });
    assert.ok(r.success);
  });

  it('rejects update without id', () => {
    const r = riderUpdateSchema.safeParse({ name: 'No ID' });
    assert.ok(!r.success);
  });

  it('accepts isActive toggle', () => {
    const r = riderUpdateSchema.safeParse({ id: 'rider-123', isActive: false });
    assert.ok(r.success);
  });
});

// ─── DriverApplication ───────────────────────────────────────────────────────

const validApp = {
  vehicleType: 'ECONOMY' as const,
  vehicleCategory: 'Economy Car',
  vehicleBrand: 'Toyota',
  vehicleModel: 'Camry',
  vehicleYear: 2022,
  plateNumber: '1234 ABC 12',
  vehicleColor: 'White',
  vehicleCapacity: 4,
  licenseNumber: 'DL-999888',
  city: 'Riyadh',
  serviceArea: 'North Riyadh',
  femaleDriver: false,
};

describe('driverApplicationSchema', () => {
  it('accepts a valid application', () => {
    const r = driverApplicationSchema.safeParse(validApp);
    assert.ok(r.success, JSON.stringify(r.error?.issues));
  });

  it('rejects invalid vehicleType', () => {
    const r = driverApplicationSchema.safeParse({ ...validApp, vehicleType: 'TRUCK' });
    assert.ok(!r.success);
  });

  it('rejects vehicleYear before 2020', () => {
    const r = driverApplicationSchema.safeParse({ ...validApp, vehicleYear: 2019 });
    assert.ok(!r.success);
  });

  it('rejects vehicleYear beyond next year', () => {
    const r = driverApplicationSchema.safeParse({ ...validApp, vehicleYear: new Date().getFullYear() + 2 });
    assert.ok(!r.success);
  });

  it('rejects vehicleCapacity of 0', () => {
    const r = driverApplicationSchema.safeParse({ ...validApp, vehicleCapacity: 0 });
    assert.ok(!r.success);
  });

  it('rejects missing city', () => {
    const { city: _, ...rest } = validApp;
    const r = driverApplicationSchema.safeParse(rest);
    assert.ok(!r.success);
  });

  it('accepts optional document URLs', () => {
    const r = driverApplicationSchema.safeParse({
      ...validApp,
      driverLicenseUrl: 'https://drive.google.com/file/123',
    });
    assert.ok(r.success);
  });

  it('rejects invalid document URL', () => {
    const r = driverApplicationSchema.safeParse({
      ...validApp,
      driverLicenseUrl: 'not-a-url',
    });
    assert.ok(!r.success);
  });

  it('accepts empty string for document URL', () => {
    const r = driverApplicationSchema.safeParse({
      ...validApp,
      driverLicenseUrl: '',
    });
    assert.ok(r.success);
  });

  it('defaults femaleDriver to false when omitted', () => {
    const { femaleDriver: _, ...rest } = validApp;
    const r = driverApplicationSchema.safeParse(rest);
    assert.ok(r.success);
    assert.equal(r.data?.femaleDriver, false);
  });
});

describe('adminReviewSchema', () => {
  it('accepts APPROVE without adminResponse', () => {
    const r = adminReviewSchema.safeParse({ action: 'APPROVE' });
    assert.ok(r.success);
  });

  it('accepts REJECT with adminResponse', () => {
    const r = adminReviewSchema.safeParse({ action: 'REJECT', adminResponse: 'Documents missing.' });
    assert.ok(r.success);
  });

  it('accepts NEEDS_CHANGES with adminResponse', () => {
    const r = adminReviewSchema.safeParse({ action: 'NEEDS_CHANGES', adminResponse: 'Please update plate number.' });
    assert.ok(r.success);
  });

  it('rejects REJECT without adminResponse', () => {
    const r = adminReviewSchema.safeParse({ action: 'REJECT' });
    assert.ok(!r.success);
  });

  it('rejects NEEDS_CHANGES with empty adminResponse', () => {
    const r = adminReviewSchema.safeParse({ action: 'NEEDS_CHANGES', adminResponse: '   ' });
    assert.ok(!r.success);
  });

  it('rejects invalid action value', () => {
    const r = adminReviewSchema.safeParse({ action: 'SUSPEND' });
    assert.ok(!r.success);
  });
});
