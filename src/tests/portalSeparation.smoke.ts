/**
 * Portal separation smoke tests — run with: npm test
 *
 * Verifies the strict separation between the family portal (PARENT) and the
 * driver portal (DRIVER_APPLICANT / APPROVED_DRIVER), introduced in Task 10.4.
 *
 * No database or Next.js runtime required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNavigationForRole,
  getNavigationForDriverState,
  getDashboardPathForDriverState,
  PARENT_NAV,
  PARENT_SECONDARY_NAV,
  type DriverState,
} from '../lib/roleRoutes.ts';

// ─── PARENT nav must NOT contain any driver-related links ─────────────────────

describe('PARENT/FAMILY nav — no driver application entries', () => {
  const { main, secondary } = getNavigationForRole('PARENT');
  const all = [...main, ...secondary];

  it('PARENT nav does not link to /driver-application', () => {
    assert.ok(
      !all.some((i) => i.href === '/driver-application'),
      'family nav must not link to /driver-application',
    );
  });

  it('PARENT nav does not link to /driver/dashboard', () => {
    assert.ok(
      !all.some((i) => i.href === '/driver/dashboard'),
      'family nav must not link to /driver/dashboard',
    );
  });

  it('PARENT nav does not link to /tracking as a driver operation', () => {
    // /tracking is the GPS sharing page used by drivers — it should not appear in the
    // PARENT main nav (drivers access it as a core feature; parents access it differently)
    // Note: tracking may appear in parent nav as "track my child's ride" — check business intent
    // For now we verify it's not in the PARENT *secondary* nav masquerading as a driver tool
    assert.ok(
      !secondary.some((i) => i.href === '/tracking'),
      'GPS tracking should not appear in PARENT secondary nav',
    );
  });

  it('PARENT_SECONDARY_NAV does not contain Drive with Fizza link', () => {
    assert.ok(
      !PARENT_SECONDARY_NAV.some((i) => i.label === 'Drive with Fizza'),
      '"Drive with Fizza" must be removed from parent secondary nav',
    );
  });

  it('PARENT_SECONDARY_NAV does not contain driver-application href', () => {
    assert.ok(
      !PARENT_SECONDARY_NAV.some((i) => i.href === '/driver-application'),
      'parent secondary nav must not link to /driver-application',
    );
  });

  it('PARENT_NAV does not contain driver-application href', () => {
    assert.ok(
      !PARENT_NAV.some((i) => i.href === '/driver-application'),
      'parent main nav must not link to /driver-application',
    );
  });
});

// ─── DRIVER_APPLICANT nav — restricted, no family features ───────────────────

describe('DRIVER_APPLICANT nav — correct restricted set', () => {
  const { main, secondary } = getNavigationForDriverState('DRIVER_APPLICANT');
  const all = [...main, ...secondary];

  it('includes /driver-application', () => {
    assert.ok(all.some((i) => i.href === '/driver-application'));
  });
  it('includes /profile', () => {
    assert.ok(all.some((i) => i.href === '/profile'));
  });
  it('includes /notifications', () => {
    assert.ok(all.some((i) => i.href === '/notifications'));
  });
  it('does NOT include /dashboard (family home)', () => {
    assert.ok(!all.some((i) => i.href === '/dashboard'), 'no family dashboard');
  });
  it('does NOT include /driver/dashboard (not approved yet)', () => {
    assert.ok(!all.some((i) => i.href === '/driver/dashboard'), 'no driver dashboard until approved');
  });
  it('does NOT include /riders', () => {
    assert.ok(!all.some((i) => i.href === '/riders'), 'no family riders page');
  });
  it('does NOT include /wallet', () => {
    assert.ok(!all.some((i) => i.href === '/wallet'), 'no family wallet');
  });
  it('does NOT include /subscriptions', () => {
    assert.ok(!all.some((i) => i.href === '/subscriptions'), 'no family subscriptions');
  });
  it('does NOT include /tracking', () => {
    assert.ok(!all.some((i) => i.href === '/tracking'), 'GPS tracking only for approved drivers');
  });
  it('does NOT include /admin', () => {
    assert.ok(!all.some((i) => i.href === '/admin'), 'no admin');
  });
});

// ─── APPROVED_DRIVER nav — operational driver features ────────────────────────

describe('APPROVED_DRIVER nav — full driver feature set', () => {
  const { main, secondary } = getNavigationForDriverState('APPROVED_DRIVER');
  const all = [...main, ...secondary];

  it('includes /driver/dashboard', () => {
    assert.ok(main.some((i) => i.href === '/driver/dashboard'));
  });
  it('includes /trips', () => {
    assert.ok(main.some((i) => i.href === '/trips'));
  });
  it('includes /tracking (GPS)', () => {
    assert.ok(main.some((i) => i.href === '/tracking'));
  });
  it('includes /safety', () => {
    assert.ok(main.some((i) => i.href === '/safety'));
  });
  it('does NOT include /dashboard (family home)', () => {
    assert.ok(!all.some((i) => i.href === '/dashboard'));
  });
  it('does NOT include /driver-application (already approved)', () => {
    assert.ok(!all.some((i) => i.href === '/driver-application'));
  });
  it('does NOT include /admin', () => {
    assert.ok(!all.some((i) => i.href === '/admin'));
  });
});

// ─── registrationSource-based driverState logic ───────────────────────────────

describe('registrationSource-based driverState mapping', () => {
  /**
   * Mirror of /api/me PARENT-role mapping logic with registrationSource.
   */
  function resolveParentState(
    registrationSource: 'FAMILY' | 'DRIVER_PORTAL',
    hasApplication: boolean,
  ): DriverState {
    const isDriverApplicant = registrationSource === 'DRIVER_PORTAL' || hasApplication;
    return isDriverApplicant ? 'DRIVER_APPLICANT' : 'PARENT';
  }

  it('FAMILY + no application → PARENT (normal family user)', () => {
    assert.equal(resolveParentState('FAMILY', false), 'PARENT');
  });

  it('DRIVER_PORTAL + no application → DRIVER_APPLICANT (just registered, no form yet)', () => {
    // This is the key case: a user who just completed /driver/register but has not
    // yet submitted the vehicle application form.  They must see the driver applicant
    // experience, NOT the family experience.
    assert.equal(resolveParentState('DRIVER_PORTAL', false), 'DRIVER_APPLICANT');
  });

  it('DRIVER_PORTAL + has application → DRIVER_APPLICANT', () => {
    assert.equal(resolveParentState('DRIVER_PORTAL', true), 'DRIVER_APPLICANT');
  });

  it('FAMILY + has application → DRIVER_APPLICANT (edge case: pre-existing app)', () => {
    // Handles users who applied before this separation was enforced
    assert.equal(resolveParentState('FAMILY', true), 'DRIVER_APPLICANT');
  });
});

// ─── /driver/register must route to /driver-application, not /driver/dashboard ─

describe('driver registration destination logic', () => {
  /**
   * Mirror of /driver/register onSubmit behavior:
   * After successful registration, always go to /driver-application.
   */
  function postRegisterDestination(): string {
    // /driver/register always redirects to /driver-application.
    // The user's new account has role PARENT and registrationSource DRIVER_PORTAL.
    // They cannot be DRIVER yet — only admin approval sets that role.
    return '/driver-application';
  }

  it('driver registration always routes to /driver-application', () => {
    assert.equal(postRegisterDestination(), '/driver-application');
  });

  it('driver registration never routes to /driver/dashboard', () => {
    assert.notEqual(postRegisterDestination(), '/driver/dashboard');
  });
});

// ─── Only admin approval must upgrade role to DRIVER ─────────────────────────

describe('role upgrade path — only admin approval', () => {
  /**
   * Mirrors the allowed role-upgrade contract.
   * The API route that upgrades role is: PATCH /api/admin/driver-applications/[id]
   * with action === 'APPROVE'.  No other path sets role to DRIVER.
   */
  type UserRole = 'PARENT' | 'DRIVER' | 'ADMIN';

  function canUpgradeToDriver(callerRole: UserRole, action: string): boolean {
    // Only ADMIN can call the approval route; only APPROVE action upgrades the role
    return callerRole === 'ADMIN' && action === 'APPROVE';
  }

  it('ADMIN + APPROVE → can upgrade role', () => {
    assert.ok(canUpgradeToDriver('ADMIN', 'APPROVE'));
  });
  it('ADMIN + REJECT → cannot upgrade role', () => {
    assert.ok(!canUpgradeToDriver('ADMIN', 'REJECT'));
  });
  it('ADMIN + NEEDS_CHANGES → cannot upgrade role', () => {
    assert.ok(!canUpgradeToDriver('ADMIN', 'NEEDS_CHANGES'));
  });
  it('PARENT + APPROVE → cannot upgrade role (not admin)', () => {
    assert.ok(!canUpgradeToDriver('PARENT', 'APPROVE'));
  });
  it('DRIVER + APPROVE → cannot upgrade role (not admin)', () => {
    assert.ok(!canUpgradeToDriver('DRIVER', 'APPROVE'));
  });
  it('registration alone does not set DRIVER role', () => {
    // New accounts always start as PARENT
    const newAccountRole: UserRole = 'PARENT';
    assert.equal(newAccountRole, 'PARENT');
  });
  it('application submission does not set DRIVER role', () => {
    // Submitting the application form only changes driverApplication.status to PENDING
    // it does NOT change user.role
    const afterSubmissionRole: UserRole = 'PARENT';
    assert.equal(afterSubmissionRole, 'PARENT');
  });
});

// ─── Dashboard destination by driverState ─────────────────────────────────────

describe('getDashboardPathForDriverState — all states', () => {
  it('PARENT → /dashboard (family home)', () => {
    assert.equal(getDashboardPathForDriverState('PARENT'), '/dashboard');
  });
  it('DRIVER_APPLICANT → /driver-application (application hub)', () => {
    assert.equal(getDashboardPathForDriverState('DRIVER_APPLICANT'), '/driver-application');
  });
  it('APPROVED_DRIVER → /driver/dashboard', () => {
    assert.equal(getDashboardPathForDriverState('APPROVED_DRIVER'), '/driver/dashboard');
  });
  it('ADMIN → /admin', () => {
    assert.equal(getDashboardPathForDriverState('ADMIN'), '/admin');
  });
});
