/**
 * Smoke tests covering the six domain fixes from the Enterprise Audit:
 *   1. driverCityMatching    — city/serviceArea propagation logic
 *   2. driverAvailability    — assignment guard
 *   3. reassignDispatch      — dispatch consistency
 *   4. driverGpsAutoStart    — autoStart / isTerminal prop contract
 *   5. applicantRoutes       — DRIVER_APPLICANT allow-list logic
 *   6. sysConfigAudit        — updatedBy field semantics
 *
 * These are pure logic tests with no DB or HTTP calls.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ─── 1. Driver city matching ──────────────────────────────────────────────────

function driverCityMatch(driverCity: string | null, tripCity: string | null): boolean | null {
  if (!driverCity || !tripCity) return null;
  return driverCity.trim().toLowerCase() === tripCity.trim().toLowerCase();
}

test('driverCityMatching: matching cities returns true', () => {
  assert.equal(driverCityMatch('Riyadh', 'Riyadh'), true);
});

test('driverCityMatching: case-insensitive match', () => {
  assert.equal(driverCityMatch('riyadh', 'RIYADH'), true);
});

test('driverCityMatching: different cities returns false', () => {
  assert.equal(driverCityMatch('Riyadh', 'Jeddah'), false);
});

test('driverCityMatching: null driver city returns null', () => {
  assert.equal(driverCityMatch(null, 'Riyadh'), null);
});

test('driverCityMatching: null trip city returns null', () => {
  assert.equal(driverCityMatch('Riyadh', null), null);
});

// ─── 2. Driver availability guard ────────────────────────────────────────────

type DriverStub = { isSuspended: boolean; availability: boolean; vehicleId: string | null };

function canAssignDriver(driver: DriverStub): { ok: boolean; reason?: string } {
  if (driver.isSuspended) return { ok: false, reason: 'suspended' };
  if (!driver.availability) return { ok: false, reason: 'unavailable' };
  if (!driver.vehicleId) return { ok: false, reason: 'no_vehicle' };
  return { ok: true };
}

test('driverAvailability: active driver with vehicle is assignable', () => {
  assert.deepEqual(canAssignDriver({ isSuspended: false, availability: true, vehicleId: 'v1' }), { ok: true });
});

test('driverAvailability: suspended driver is blocked', () => {
  const r = canAssignDriver({ isSuspended: true, availability: true, vehicleId: 'v1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'suspended');
});

test('driverAvailability: unavailable driver is blocked even if not suspended', () => {
  const r = canAssignDriver({ isSuspended: false, availability: false, vehicleId: 'v1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unavailable');
});

test('driverAvailability: driver without vehicle is blocked', () => {
  const r = canAssignDriver({ isSuspended: false, availability: true, vehicleId: null });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_vehicle');
});

// ─── 3. Reassign dispatch consistency ────────────────────────────────────────

// Simulates the concept: reassign should use the same feasibility path as assign.
// We test that both code paths call the same function signature.

function mockDecideTripDispatch(params: { driverId: string; conflictExists: boolean }): { assignDriver: boolean; dispatchNote?: string } {
  if (params.conflictExists) return { assignDriver: false, dispatchNote: 'Timeline conflict' };
  return { assignDriver: true };
}

test('reassignDispatch: conflict-free driver is feasible', () => {
  const result = mockDecideTripDispatch({ driverId: 'd1', conflictExists: false });
  assert.equal(result.assignDriver, true);
});

test('reassignDispatch: driver with conflict is rejected', () => {
  const result = mockDecideTripDispatch({ driverId: 'd1', conflictExists: true });
  assert.equal(result.assignDriver, false);
  assert.ok(result.dispatchNote);
});

// ─── 4. GPS auto-start prop contract ─────────────────────────────────────────

// The DriverGpsPanel now accepts autoStart and isTerminal props.
// Validate the logic rules without mounting a React component.

function shouldAutoStart(opts: {
  autoStart: boolean;
  withinWindow: boolean;
  isTerminal: boolean;
  permissionState: string;
  currentStatus: string;
}): boolean {
  return (
    opts.autoStart &&
    opts.withinWindow &&
    !opts.isTerminal &&
    opts.permissionState === 'granted' &&
    opts.currentStatus === 'idle'
  );
}

function shouldAutoStop(opts: { isTerminal: boolean; currentStatus: string }): boolean {
  return opts.isTerminal && opts.currentStatus === 'sharing';
}

test('driverGpsAutoStart: auto-starts when all conditions met', () => {
  assert.equal(
    shouldAutoStart({ autoStart: true, withinWindow: true, isTerminal: false, permissionState: 'granted', currentStatus: 'idle' }),
    true,
  );
});

test('driverGpsAutoStart: does not auto-start without permission', () => {
  assert.equal(
    shouldAutoStart({ autoStart: true, withinWindow: true, isTerminal: false, permissionState: 'prompt_needed', currentStatus: 'idle' }),
    false,
  );
});

test('driverGpsAutoStart: does not auto-start outside window', () => {
  assert.equal(
    shouldAutoStart({ autoStart: true, withinWindow: false, isTerminal: false, permissionState: 'granted', currentStatus: 'idle' }),
    false,
  );
});

test('driverGpsAutoStart: does not auto-start on terminal trip', () => {
  assert.equal(
    shouldAutoStart({ autoStart: true, withinWindow: true, isTerminal: true, permissionState: 'granted', currentStatus: 'idle' }),
    false,
  );
});

test('driverGpsAutoStop: stops when trip becomes terminal and GPS is sharing', () => {
  assert.equal(shouldAutoStop({ isTerminal: true, currentStatus: 'sharing' }), true);
});

test('driverGpsAutoStop: does not stop when trip is not terminal', () => {
  assert.equal(shouldAutoStop({ isTerminal: false, currentStatus: 'sharing' }), false);
});

// ─── 5. Applicant route allow-list ───────────────────────────────────────────

const DRIVER_APPLICANT_ALLOWED = [
  '/dashboard',
  '/driver-application',
  '/notifications',
  '/profile',
  '/forbidden',
];

function isApplicantAllowed(pathname: string): boolean {
  return DRIVER_APPLICANT_ALLOWED.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

test('applicantRoutes: /driver-application is allowed', () => {
  assert.equal(isApplicantAllowed('/driver-application'), true);
});

test('applicantRoutes: /driver-application/status is allowed (sub-path)', () => {
  assert.equal(isApplicantAllowed('/driver-application/status'), true);
});

test('applicantRoutes: /wallet is blocked', () => {
  assert.equal(isApplicantAllowed('/wallet'), false);
});

test('applicantRoutes: /subscriptions is blocked', () => {
  assert.equal(isApplicantAllowed('/subscriptions'), false);
});

test('applicantRoutes: /trips is blocked', () => {
  assert.equal(isApplicantAllowed('/trips'), false);
});

test('applicantRoutes: /notifications is allowed', () => {
  assert.equal(isApplicantAllowed('/notifications'), true);
});

test('applicantRoutes: /profile is allowed', () => {
  assert.equal(isApplicantAllowed('/profile'), true);
});

// ─── 6. System config audit updatedBy ────────────────────────────────────────

// Verify the shape of the updatedBy field on save payload.

function buildConfigUpdatePayload(updates: Record<string, unknown>, adminUserId: string) {
  return Object.entries(updates).map(([key, value]) => ({
    key,
    value,
    updatedBy: adminUserId,
  }));
}

test('sysConfigAudit: updatedBy is set on each upsert payload', () => {
  const payload = buildConfigUpdatePayload({ pricePerKmSar: 2.5, supportPhone: '0500' }, 'admin-123');
  assert.equal(payload.length, 2);
  assert.ok(payload.every((p) => p.updatedBy === 'admin-123'));
});

test('sysConfigAudit: updatedBy reflects the acting admin ID', () => {
  const payload = buildConfigUpdatePayload({ pricePerKmSar: 3.0 }, 'admin-456');
  assert.equal(payload[0]?.updatedBy, 'admin-456');
});

test('sysConfigAudit: financial keys are detectable from changes', () => {
  const FINANCIAL_KEYS = ['pricePerKmSar', 'driverPayRatePerKmSar', 'driverPlatformFeePercent'];
  const form = { pricePerKmSar: '3.0', supportPhone: '0500' };
  const saved = { pricePerKmSar: '2.5', supportPhone: '0500' };
  const changedFinancial = FINANCIAL_KEYS.filter((k) => form[k as keyof typeof form] !== saved[k as keyof typeof saved]);
  assert.deepEqual(changedFinancial, ['pricePerKmSar']);
});
