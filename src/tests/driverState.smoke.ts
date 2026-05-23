/**
 * driverState smoke tests — run with: npm test
 *
 * Verifies the DriverState-aware helpers added in Task 10.3:
 *   - getNavigationForDriverState
 *   - getDashboardPathForDriverState
 *   - /api/me driverState mapping logic (pure function equivalents)
 *
 * No database or Next.js runtime required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDashboardPathForDriverState,
  getNavigationForDriverState,
  type DriverState,
} from '../lib/roleRoutes.ts';

// ─── getDashboardPathForDriverState ───────────────────────────────────────────

describe('getDashboardPathForDriverState', () => {
  it('ADMIN → /admin', () => {
    assert.equal(getDashboardPathForDriverState('ADMIN'), '/admin');
  });
  it('APPROVED_DRIVER → /driver/dashboard', () => {
    assert.equal(getDashboardPathForDriverState('APPROVED_DRIVER'), '/driver/dashboard');
  });
  it('APPLICANT → /driver-application', () => {
    assert.equal(getDashboardPathForDriverState('DRIVER_APPLICANT'), '/driver-application');
  });
  it('PARENT → /dashboard', () => {
    assert.equal(getDashboardPathForDriverState('PARENT'), '/dashboard');
  });
});

// ─── getNavigationForDriverState — ADMIN ──────────────────────────────────────

describe('getNavigationForDriverState — ADMIN', () => {
  const { main, secondary } = getNavigationForDriverState('ADMIN');
  const all = [...main, ...secondary];

  it('includes /admin', () => {
    assert.ok(main.some((i) => i.href === '/admin'), 'should include /admin in main');
  });
  it('does NOT include /dashboard', () => {
    assert.ok(!all.some((i) => i.href === '/dashboard'), 'should not include parent dashboard');
  });
  it('does NOT include /driver/dashboard', () => {
    assert.ok(!all.some((i) => i.href === '/driver/dashboard'), 'should not include driver dashboard');
  });
  it('does NOT include /driver-application', () => {
    assert.ok(!all.some((i) => i.href === '/driver-application'), 'should not include driver application');
  });
});

// ─── getNavigationForDriverState — APPROVED_DRIVER ───────────────────────────

describe('getNavigationForDriverState — APPROVED_DRIVER', () => {
  const { main, secondary } = getNavigationForDriverState('APPROVED_DRIVER');
  const all = [...main, ...secondary];

  it('includes /driver/dashboard', () => {
    assert.ok(main.some((i) => i.href === '/driver/dashboard'), 'should include driver dashboard');
  });
  it('includes /trips', () => {
    assert.ok(main.some((i) => i.href === '/trips'), 'should include trips');
  });
  it('includes /tracking', () => {
    assert.ok(main.some((i) => i.href === '/tracking'), 'should include GPS tracking');
  });
  it('includes /safety', () => {
    assert.ok(main.some((i) => i.href === '/safety'), 'should include safety');
  });
  it('does NOT include /dashboard (parent home)', () => {
    assert.ok(!all.some((i) => i.href === '/dashboard'), 'should not include parent dashboard');
  });
  it('does NOT include /admin', () => {
    assert.ok(!all.some((i) => i.href === '/admin'), 'should not include admin');
  });
  it('does NOT include /driver-application (already approved)', () => {
    assert.ok(!all.some((i) => i.href === '/driver-application'), 'should not include application page');
  });
});

// ─── getNavigationForDriverState — APPLICANT ─────────────────────────────────

describe('getNavigationForDriverState — APPLICANT', () => {
  const { main, secondary } = getNavigationForDriverState('DRIVER_APPLICANT');
  const all = [...main, ...secondary];

  it('includes /driver-application', () => {
    assert.ok(main.some((i) => i.href === '/driver-application'), 'should include application page');
  });
  it('includes /notifications', () => {
    assert.ok(main.some((i) => i.href === '/notifications'), 'should include notifications');
  });
  it('includes /profile in secondary', () => {
    assert.ok(secondary.some((i) => i.href === '/profile'), 'should include profile in secondary');
  });
  it('does NOT include /driver/dashboard', () => {
    assert.ok(!all.some((i) => i.href === '/driver/dashboard'), 'should not include driver dashboard');
  });
  it('does NOT include /trips', () => {
    assert.ok(!all.some((i) => i.href === '/trips'), 'should not include trips');
  });
  it('does NOT include /tracking', () => {
    assert.ok(!all.some((i) => i.href === '/tracking'), 'should not include GPS tracking');
  });
  it('does NOT include /admin', () => {
    assert.ok(!all.some((i) => i.href === '/admin'), 'should not include admin');
  });
  it('does NOT include /dashboard (parent home)', () => {
    assert.ok(!all.some((i) => i.href === '/dashboard'), 'should not include parent dashboard');
  });
});

// ─── getNavigationForDriverState — PARENT ────────────────────────────────────

describe('getNavigationForDriverState — PARENT', () => {
  const { main, secondary } = getNavigationForDriverState('PARENT');
  const all = [...main, ...secondary];

  it('includes /dashboard', () => {
    assert.ok(main.some((i) => i.href === '/dashboard'), 'should include parent dashboard');
  });
  it('includes /riders', () => {
    assert.ok(main.some((i) => i.href === '/riders'), 'should include riders');
  });
  it('includes /subscriptions', () => {
    assert.ok(main.some((i) => i.href === '/subscriptions'), 'should include subscriptions');
  });
  it('includes /wallet', () => {
    assert.ok(main.some((i) => i.href === '/wallet'), 'should include wallet');
  });
  it('does NOT include /driver/dashboard', () => {
    assert.ok(!all.some((i) => i.href === '/driver/dashboard'), 'should not include driver dashboard');
  });
  it('does NOT include /admin', () => {
    assert.ok(!all.some((i) => i.href === '/admin'), 'should not include admin');
  });
});

// ─── driverState mapping logic (mirrors /api/me DB logic, pure) ───────────────
//
// These tests verify the mapping contract between JWT role + application status
// and the driverState value returned by /api/me.

describe('driverState mapping contract', () => {
  /**
   * Pure mirror of /api/me mapping logic — no DB or JWT required.
   * Now includes registrationSource (Task 10.4 addition).
   * Update this if the API logic changes.
   */
  function computeDriverState(
    role: string,
    registrationSource: 'FAMILY' | 'DRIVER_PORTAL',
    applicationStatus: string | null,
  ): DriverState {
    if (role === 'ADMIN')  return 'ADMIN';
    if (role === 'DRIVER') return 'APPROVED_DRIVER';
    // PARENT role: driver applicant if came from driver portal OR has any application
    const isDriverApplicant = registrationSource === 'DRIVER_PORTAL' || applicationStatus !== null;
    return isDriverApplicant ? 'DRIVER_APPLICANT' : 'PARENT';
  }

  it('ADMIN role → ADMIN', () => {
    assert.equal(computeDriverState('ADMIN', 'FAMILY', null), 'ADMIN');
  });
  it('DRIVER role → APPROVED_DRIVER', () => {
    assert.equal(computeDriverState('DRIVER', 'FAMILY', null), 'APPROVED_DRIVER');
  });
  it('PARENT + FAMILY source + no application → PARENT', () => {
    assert.equal(computeDriverState('PARENT', 'FAMILY', null), 'PARENT');
  });
  it('PARENT + DRIVER_PORTAL source + no application → DRIVER_APPLICANT', () => {
    // New account from /driver/register before submitting form
    assert.equal(computeDriverState('PARENT', 'DRIVER_PORTAL', null), 'DRIVER_APPLICANT');
  });
  it('PARENT + FAMILY source + PENDING application → DRIVER_APPLICANT', () => {
    // Edge: family user somehow has an application (should not happen in new flow)
    assert.equal(computeDriverState('PARENT', 'FAMILY', 'PENDING'), 'DRIVER_APPLICANT');
  });
  it('PARENT + DRIVER_PORTAL + PENDING → DRIVER_APPLICANT', () => {
    assert.equal(computeDriverState('PARENT', 'DRIVER_PORTAL', 'PENDING'), 'DRIVER_APPLICANT');
  });
  it('PARENT + DRIVER_PORTAL + NEEDS_CHANGES → DRIVER_APPLICANT', () => {
    assert.equal(computeDriverState('PARENT', 'DRIVER_PORTAL', 'NEEDS_CHANGES'), 'DRIVER_APPLICANT');
  });
  it('PARENT + DRIVER_PORTAL + REJECTED → DRIVER_APPLICANT', () => {
    assert.equal(computeDriverState('PARENT', 'DRIVER_PORTAL', 'REJECTED'), 'DRIVER_APPLICANT');
  });
  it('PARENT + APPROVED application (JWT not refreshed) → DRIVER_APPLICANT', () => {
    // /api/me returns DRIVER_APPLICANT; the approved card prompts re-login.
    assert.equal(computeDriverState('PARENT', 'DRIVER_PORTAL', 'APPROVED'), 'DRIVER_APPLICANT');
  });
});

// ─── Navigation completeness — all four states have non-empty main nav ────────

describe('getNavigationForDriverState — all states have non-empty nav', () => {
  const states: DriverState[] = ['PARENT', 'DRIVER_APPLICANT', 'APPROVED_DRIVER', 'ADMIN'];

  for (const state of states) {
    it(`${state} has at least one main nav item`, () => {
      const { main } = getNavigationForDriverState(state);
      assert.ok(main.length > 0, `${state} main nav must not be empty`);
    });
  }
});

// ─── getDashboardPathForDriverState matches getNavigationForDriverState home ──

describe('dashboard path vs nav home consistency', () => {
  it('PARENT dashboard path matches nav home', () => {
    const path = getDashboardPathForDriverState('PARENT');
    const { main } = getNavigationForDriverState('PARENT');
    assert.ok(main.some((i) => i.href === path), 'dashboard path must appear in main nav');
  });
  it('ADMIN dashboard path matches nav home', () => {
    const path = getDashboardPathForDriverState('ADMIN');
    const { main } = getNavigationForDriverState('ADMIN');
    assert.ok(main.some((i) => i.href === path), 'dashboard path must appear in main nav');
  });
  it('APPROVED_DRIVER dashboard path matches nav home', () => {
    const path = getDashboardPathForDriverState('APPROVED_DRIVER');
    const { main } = getNavigationForDriverState('APPROVED_DRIVER');
    assert.ok(main.some((i) => i.href === path), 'dashboard path must appear in main nav');
  });
  it('APPLICANT dashboard path is /driver-application (not in main nav — no home concept)', () => {
    const path = getDashboardPathForDriverState('DRIVER_APPLICANT');
    assert.equal(path, '/driver-application');
  });
});
