/**
 * Driver portal smoke tests — run with: npm test
 * Tests routing helpers, applicant state detection, and nav selection logic.
 * No database or Next.js runtime required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDashboardPathForRole,
  isApprovedDriver,
  isPendingDriverApplicant,
  getDriverPortalPath,
  isRouteAllowedForRole,
  isRouteAllowedForApplicant,
  getNavigationForRole,
  getNavigationForApplicant,
} from '../lib/roleRoutes.ts';

// ─── isApprovedDriver ─────────────────────────────────────────────────────────

describe('isApprovedDriver', () => {
  it('returns true for DRIVER role', () => {
    assert.ok(isApprovedDriver('DRIVER'));
  });
  it('returns false for PARENT', () => {
    assert.ok(!isApprovedDriver('PARENT'));
  });
  it('returns false for ADMIN', () => {
    assert.ok(!isApprovedDriver('ADMIN'));
  });
  it('returns false for empty string', () => {
    assert.ok(!isApprovedDriver(''));
  });
});

// ─── isPendingDriverApplicant ─────────────────────────────────────────────────

describe('isPendingDriverApplicant', () => {
  it('returns true for PENDING status', () => {
    assert.ok(isPendingDriverApplicant('PENDING'));
  });
  it('returns true for NEEDS_CHANGES status', () => {
    assert.ok(isPendingDriverApplicant('NEEDS_CHANGES'));
  });
  it('returns true for REJECTED status', () => {
    assert.ok(isPendingDriverApplicant('REJECTED'));
  });
  it('returns false for APPROVED status', () => {
    assert.ok(!isPendingDriverApplicant('APPROVED'));
  });
  it('returns false for null (no application)', () => {
    assert.ok(!isPendingDriverApplicant(null));
  });
  it('returns false for undefined', () => {
    assert.ok(!isPendingDriverApplicant(undefined));
  });
  it('returns false for empty string', () => {
    assert.ok(!isPendingDriverApplicant(''));
  });
});

// ─── getDriverPortalPath ──────────────────────────────────────────────────────

describe('getDriverPortalPath', () => {
  it('APPROVED → /driver/dashboard', () => {
    assert.equal(getDriverPortalPath('APPROVED'), '/driver/dashboard');
  });
  it('PENDING → /driver-application', () => {
    assert.equal(getDriverPortalPath('PENDING'), '/driver-application');
  });
  it('NEEDS_CHANGES → /driver-application', () => {
    assert.equal(getDriverPortalPath('NEEDS_CHANGES'), '/driver-application');
  });
  it('REJECTED → /driver-application', () => {
    assert.equal(getDriverPortalPath('REJECTED'), '/driver-application');
  });
  it('null (no application) → /driver-application', () => {
    assert.equal(getDriverPortalPath(null), '/driver-application');
  });
});

// ─── isRouteAllowedForApplicant ───────────────────────────────────────────────

describe('isRouteAllowedForApplicant', () => {
  it('allows /driver-application', () => {
    assert.ok(isRouteAllowedForApplicant('/driver-application'));
  });
  it('allows /profile', () => {
    assert.ok(isRouteAllowedForApplicant('/profile'));
  });
  it('allows /notifications', () => {
    assert.ok(isRouteAllowedForApplicant('/notifications'));
  });
  it('blocks /driver/dashboard', () => {
    assert.ok(!isRouteAllowedForApplicant('/driver/dashboard'));
  });
  it('blocks /trips', () => {
    assert.ok(!isRouteAllowedForApplicant('/trips'));
  });
  it('blocks /tracking', () => {
    assert.ok(!isRouteAllowedForApplicant('/tracking'));
  });
  it('blocks /admin', () => {
    assert.ok(!isRouteAllowedForApplicant('/admin'));
  });
  it('blocks /dashboard', () => {
    assert.ok(!isRouteAllowedForApplicant('/dashboard'));
  });
});

// ─── isRouteAllowedForRole (DRIVER = approved) ────────────────────────────────

describe('isRouteAllowedForRole — approved DRIVER', () => {
  it('DRIVER can access /driver/dashboard', () => {
    assert.ok(isRouteAllowedForRole('/driver/dashboard', 'DRIVER'));
  });
  it('DRIVER can access /trips', () => {
    assert.ok(isRouteAllowedForRole('/trips', 'DRIVER'));
  });
  it('DRIVER can access /tracking', () => {
    assert.ok(isRouteAllowedForRole('/tracking', 'DRIVER'));
  });
  it('DRIVER is NOT allowed /admin', () => {
    assert.ok(!isRouteAllowedForRole('/admin', 'DRIVER'));
  });
  it('DRIVER is NOT allowed /dashboard (parent page)', () => {
    assert.ok(!isRouteAllowedForRole('/dashboard', 'DRIVER'));
  });
});

// ─── getNavigationForApplicant ────────────────────────────────────────────────

describe('getNavigationForApplicant', () => {
  const nav = getNavigationForApplicant();

  it('includes /driver-application', () => {
    assert.ok(nav.main.some((i) => i.href === '/driver-application'));
  });
  it('includes /notifications', () => {
    assert.ok(nav.main.some((i) => i.href === '/notifications'));
  });
  it('includes /profile in secondary', () => {
    assert.ok(nav.secondary.some((i) => i.href === '/profile'));
  });
  it('does NOT include /driver/dashboard', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/driver/dashboard'));
  });
  it('does NOT include /trips', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/trips'));
  });
  it('does NOT include /tracking', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/tracking'));
  });
  it('does NOT include /admin', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/admin'));
  });
});

// ─── getNavigationForRole — approved driver ───────────────────────────────────

describe('getNavigationForRole — approved DRIVER', () => {
  const nav = getNavigationForRole('DRIVER');

  it('includes /driver/dashboard', () => {
    assert.ok(nav.main.some((i) => i.href === '/driver/dashboard'));
  });
  it('includes /trips', () => {
    assert.ok(nav.main.some((i) => i.href === '/trips'));
  });
  it('includes /tracking', () => {
    assert.ok(nav.main.some((i) => i.href === '/tracking'));
  });
  it('does NOT include /dashboard (parent home)', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/dashboard'));
  });
  it('does NOT include /admin', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/admin'));
  });
  it('does NOT include /driver-application (already approved)', () => {
    const all = [...nav.main, ...nav.secondary];
    assert.ok(!all.some((i) => i.href === '/driver-application'));
  });
});

// ─── Role dashboard paths ─────────────────────────────────────────────────────

describe('getDashboardPathForRole', () => {
  it('ADMIN → /admin', () => {
    assert.equal(getDashboardPathForRole('ADMIN'), '/admin');
  });
  it('DRIVER → /driver/dashboard', () => {
    assert.equal(getDashboardPathForRole('DRIVER'), '/driver/dashboard');
  });
  it('PARENT → /dashboard', () => {
    assert.equal(getDashboardPathForRole('PARENT'), '/dashboard');
  });
  it('unknown → /dashboard (safe fallback)', () => {
    assert.equal(getDashboardPathForRole('UNKNOWN'), '/dashboard');
  });
});

// ─── Logical state matrix ─────────────────────────────────────────────────────

describe('applicant vs approved driver state matrix', () => {
  // A PARENT with PENDING app → isPendingDriverApplicant → restricted nav
  it('PARENT + PENDING → applicant nav, not driver nav', () => {
    const isApplicant = isPendingDriverApplicant('PENDING');
    const nav = isApplicant ? getNavigationForApplicant() : getNavigationForRole('PARENT');
    assert.ok(nav.main.some((i) => i.href === '/driver-application'), 'should show application link');
    assert.ok(!nav.main.some((i) => i.href === '/driver/dashboard'), 'should not show driver dashboard');
  });

  // A PARENT with no application → parent nav (no driver ops)
  it('PARENT + no application → parent nav', () => {
    const isApplicant = isPendingDriverApplicant(null);
    const nav = isApplicant ? getNavigationForApplicant() : getNavigationForRole('PARENT');
    assert.ok(nav.main.some((i) => i.href === '/dashboard'), 'should show parent dashboard');
    assert.ok(!nav.main.some((i) => i.href === '/driver/dashboard'), 'should not show driver dashboard');
  });

  // An approved driver (role === DRIVER) → full driver nav
  it('DRIVER role → full driver nav', () => {
    const nav = getNavigationForRole('DRIVER');
    assert.ok(nav.main.some((i) => i.href === '/driver/dashboard'), 'should show driver dashboard');
    assert.ok(nav.main.some((i) => i.href === '/trips'), 'should show trips');
    assert.ok(!nav.main.some((i) => i.href === '/dashboard'), 'should not show parent dashboard');
  });

  // An approved driver hitting /driver-application → isApprovedDriver = true
  it('isApprovedDriver correctly identifies DRIVER role', () => {
    assert.ok(isApprovedDriver('DRIVER'));
    assert.ok(!isApprovedDriver('PARENT'));
  });

  // getDriverPortalPath correctly routes approved vs pending
  it('getDriverPortalPath routes APPROVED to driver dashboard', () => {
    assert.equal(getDriverPortalPath('APPROVED'), '/driver/dashboard');
    assert.equal(getDriverPortalPath('PENDING'), '/driver-application');
    assert.equal(getDriverPortalPath('NEEDS_CHANGES'), '/driver-application');
  });
});
