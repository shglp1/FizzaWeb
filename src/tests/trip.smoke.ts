/**
 * Trip module smoke tests — run with: npm test
 * Tests cover Zod validation schemas and pure status-transition logic.
 * DB-level authorization (ownership, driver scoping) is enforced server-side
 * and requires a live database for integration testing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tripStatusUpdateSchema,
  driverLocationSchema,
  driverAssignSchema,
  tripGenerateSchema,
  isValidStatusTransition,
  CANCELLABLE_BY_PARENT,
} from '../lib/validations/trip.ts';

// ─── tripStatusUpdateSchema ───────────────────────────────────────────────────

describe('tripStatusUpdateSchema', () => {
  it('accepts ON_THE_WAY', () => {
    assert.ok(tripStatusUpdateSchema.safeParse({ status: 'ON_THE_WAY' }).success);
  });

  it('accepts PICKED_UP', () => {
    assert.ok(tripStatusUpdateSchema.safeParse({ status: 'PICKED_UP' }).success);
  });

  it('accepts COMPLETED', () => {
    assert.ok(tripStatusUpdateSchema.safeParse({ status: 'COMPLETED' }).success);
  });

  it('accepts DRIVER_ASSIGNED', () => {
    assert.ok(tripStatusUpdateSchema.safeParse({ status: 'DRIVER_ASSIGNED' }).success);
  });

  it('rejects SCHEDULED (not settable via status endpoint)', () => {
    assert.ok(!tripStatusUpdateSchema.safeParse({ status: 'SCHEDULED' }).success);
  });

  it('rejects CANCELLED (has its own cancel endpoint)', () => {
    assert.ok(!tripStatusUpdateSchema.safeParse({ status: 'CANCELLED' }).success);
  });

  it('rejects arbitrary string', () => {
    assert.ok(!tripStatusUpdateSchema.safeParse({ status: 'PAUSED' }).success);
  });

  it('rejects missing status', () => {
    assert.ok(!tripStatusUpdateSchema.safeParse({}).success);
  });
});

// ─── driverLocationSchema ─────────────────────────────────────────────────────

describe('driverLocationSchema', () => {
  it('accepts valid Riyadh coordinates', () => {
    assert.ok(driverLocationSchema.safeParse({ lat: 24.7136, lng: 46.6753 }).success);
  });

  it('accepts edge values (0, 0)', () => {
    assert.ok(driverLocationSchema.safeParse({ lat: 0, lng: 0 }).success);
  });

  it('accepts extreme valid values', () => {
    assert.ok(driverLocationSchema.safeParse({ lat: 90, lng: 180 }).success);
    assert.ok(driverLocationSchema.safeParse({ lat: -90, lng: -180 }).success);
  });

  it('rejects lat > 90', () => {
    assert.ok(!driverLocationSchema.safeParse({ lat: 91, lng: 0 }).success);
  });

  it('rejects lat < -90', () => {
    assert.ok(!driverLocationSchema.safeParse({ lat: -91, lng: 0 }).success);
  });

  it('rejects lng > 180', () => {
    assert.ok(!driverLocationSchema.safeParse({ lat: 0, lng: 181 }).success);
  });

  it('rejects lng < -180', () => {
    assert.ok(!driverLocationSchema.safeParse({ lat: 0, lng: -181 }).success);
  });

  it('rejects string coordinates', () => {
    assert.ok(!driverLocationSchema.safeParse({ lat: '24.71', lng: '46.67' }).success);
  });

  it('rejects missing lat', () => {
    assert.ok(!driverLocationSchema.safeParse({ lng: 46.6753 }).success);
  });
});

// ─── driverAssignSchema ───────────────────────────────────────────────────────

describe('driverAssignSchema', () => {
  it('accepts a valid UUID', () => {
    assert.ok(
      driverAssignSchema.safeParse({ driverId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }).success,
    );
  });

  it('rejects a non-UUID string', () => {
    assert.ok(!driverAssignSchema.safeParse({ driverId: 'not-a-uuid' }).success);
  });

  it('rejects missing driverId', () => {
    assert.ok(!driverAssignSchema.safeParse({}).success);
  });
});

// ─── tripGenerateSchema ───────────────────────────────────────────────────────

describe('tripGenerateSchema', () => {
  it('accepts empty object (uses defaults)', () => {
    assert.ok(tripGenerateSchema.safeParse({}).success);
  });

  it('accepts valid YYYY-MM-DD dates', () => {
    assert.ok(
      tripGenerateSchema.safeParse({ startDate: '2026-09-01', endDate: '2026-09-07' }).success,
    );
  });

  it('rejects non-YYYY-MM-DD format', () => {
    assert.ok(!tripGenerateSchema.safeParse({ startDate: '01/09/2026' }).success);
  });

  it('accepts only startDate', () => {
    assert.ok(tripGenerateSchema.safeParse({ startDate: '2026-09-01' }).success);
  });

  it('accepts only endDate', () => {
    assert.ok(tripGenerateSchema.safeParse({ endDate: '2026-09-07' }).success);
  });
});

// ─── isValidStatusTransition ──────────────────────────────────────────────────

describe('isValidStatusTransition (driver)', () => {
  it('DRIVER_ASSIGNED → ON_THE_WAY is allowed', () => {
    assert.ok(isValidStatusTransition('DRIVER_ASSIGNED', 'ON_THE_WAY', 'DRIVER'));
  });

  it('ON_THE_WAY → PICKED_UP is allowed', () => {
    assert.ok(isValidStatusTransition('ON_THE_WAY', 'PICKED_UP', 'DRIVER'));
  });

  it('PICKED_UP → COMPLETED is allowed', () => {
    assert.ok(isValidStatusTransition('PICKED_UP', 'COMPLETED', 'DRIVER'));
  });

  it('SCHEDULED → ON_THE_WAY is NOT allowed for driver', () => {
    assert.ok(!isValidStatusTransition('SCHEDULED', 'ON_THE_WAY', 'DRIVER'));
  });

  it('ON_THE_WAY → DRIVER_ASSIGNED (backward) is NOT allowed', () => {
    assert.ok(!isValidStatusTransition('ON_THE_WAY', 'DRIVER_ASSIGNED', 'DRIVER'));
  });

  it('COMPLETED → PICKED_UP (backward) is NOT allowed', () => {
    assert.ok(!isValidStatusTransition('COMPLETED', 'PICKED_UP', 'DRIVER'));
  });

  it('CANCELLED → ON_THE_WAY is NOT allowed', () => {
    assert.ok(!isValidStatusTransition('CANCELLED', 'ON_THE_WAY', 'DRIVER'));
  });
});

describe('isValidStatusTransition (admin)', () => {
  it('SCHEDULED → DRIVER_ASSIGNED is allowed for admin', () => {
    assert.ok(isValidStatusTransition('SCHEDULED', 'DRIVER_ASSIGNED', 'ADMIN'));
  });

  it('SCHEDULED → COMPLETED is allowed for admin (skip ahead)', () => {
    assert.ok(isValidStatusTransition('SCHEDULED', 'COMPLETED', 'ADMIN'));
  });

  it('DRIVER_ASSIGNED → COMPLETED is allowed for admin', () => {
    assert.ok(isValidStatusTransition('DRIVER_ASSIGNED', 'COMPLETED', 'ADMIN'));
  });

  it('COMPLETED → PICKED_UP is NOT allowed even for admin', () => {
    assert.ok(!isValidStatusTransition('COMPLETED', 'PICKED_UP', 'ADMIN'));
  });

  it('CANCELLED → SCHEDULED is NOT allowed even for admin', () => {
    assert.ok(!isValidStatusTransition('CANCELLED', 'SCHEDULED', 'ADMIN'));
  });
});

// ─── CANCELLABLE_BY_PARENT ────────────────────────────────────────────────────

describe('CANCELLABLE_BY_PARENT', () => {
  it('includes SCHEDULED', () => {
    assert.ok(CANCELLABLE_BY_PARENT.includes('SCHEDULED'));
  });

  it('includes DRIVER_ASSIGNED', () => {
    assert.ok(CANCELLABLE_BY_PARENT.includes('DRIVER_ASSIGNED'));
  });

  it('does not include ON_THE_WAY', () => {
    assert.ok(!CANCELLABLE_BY_PARENT.includes('ON_THE_WAY'));
  });

  it('does not include COMPLETED', () => {
    assert.ok(!CANCELLABLE_BY_PARENT.includes('COMPLETED'));
  });

  it('does not include CANCELLED', () => {
    assert.ok(!CANCELLABLE_BY_PARENT.includes('CANCELLED'));
  });
});
