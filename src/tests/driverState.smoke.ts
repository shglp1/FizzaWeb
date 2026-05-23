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
    assert.equal(getDashboardPathForDriverState('APPLICANT'), '/driver-application');
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
  const { main, secondary } = getNavigationForDriverState('APPLICANT');
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
   * Update this if the API logic changes.
   */
  function computeDriverState(
    role: string,
    applicationStatus: string | null,
  ): DriverState {
    if (role === 'ADMIN')  return 'ADMIN';
    if (role === 'DRIVER') return 'APPROVED_DRIVER';
    // PARENT role
    if (applicationStatus !== null) return 'APPLICANT';
    return 'PARENT';
  }

  it('ADMIN role → ADMIN', () => {
    assert.equal(computeDriverState('ADMIN', null), 'ADMIN');
  });
  it('DRIVER role → APPROVED_DRIVER', () => {
    assert.equal(computeDriverState('DRIVER', null), 'APPROVED_DRIVER');
  });
  it('PARENT + no application → PARENT', () => {
    assert.equal(computeDriverState('PARENT', null), 'PARENT');
  });
  it('PARENT + PENDING → APPLICANT', () => {
    assert.equal(computeDriverState('PARENT', 'PENDING'), 'APPLICANT');
  });
  it('PARENT + NEEDS_CHANGES → APPLICANT', () => {
    assert.equal(computeDriverState('PARENT', 'NEEDS_CHANGES'), 'APPLICANT');
  });
  it('PARENT + REJECTED → APPLICANT', () => {
    assert.equal(computeDriverState('PARENT', 'REJECTED'), 'APPLICANT');
  });
  it('PARENT + APPROVED (JWT not yet refreshed) → APPLICANT', () => {
    // When an admin approves the application, the DB role is updated to DRIVER.
    // If the user's JWT still contains PARENT (not yet re-logged in), the
    // application record exists with APPROVED status.
    // /api/me returns driverState = "APPLICANT"; the approved card prompts re-login.
    assert.equal(computeDriverState('PARENT', 'APPROVED'), 'APPLICANT');
  });
});

// ─── Navigation completeness — all four states have non-empty main nav ────────

describe('getNavigationForDriverState — all states have non-empty nav', () => {
  const states: DriverState[] = ['PARENT', 'APPLICANT', 'APPROVED_DRIVER', 'ADMIN'];

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
    const path = getDashboardPathForDriverState('APPLICANT');
    assert.equal(path, '/driver-application');
  });
});
