/**
 * Admin shell & navigation smoke tests — run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_SECTIONS,
  adminSectionHref,
  PARENT_ONLY_NAV_HREFS,
  parseAdminSection,
} from '../lib/adminNav.ts';
import {
  getNavigationForDriverState,
  getDashboardPathForDriverState,
  PARENT_NAV,
  PARENT_SECONDARY_NAV,
  DRIVER_NAV,
  DRIVER_APPLICANT_NAV,
} from '../lib/roleRoutes.ts';

describe('Admin section navigation', () => {
  it('includes required admin sections', () => {
    const sections = ADMIN_SECTIONS.map((s) => s.section);
    for (const required of [
      'overview',
      'users',
      'drivers',
      'applications',
      'packages',
      'financials',
      'audit',
    ]) {
      assert.ok(sections.includes(required as typeof sections[number]), `missing ${required}`);
    }
  });

  it('section links use /admin?section= query params', () => {
    assert.equal(adminSectionHref('users'), '/admin?section=users');
    assert.equal(parseAdminSection('trips'), 'trips');
    assert.equal(parseAdminSection('invalid'), 'overview');
  });

  it('admin sections do not use parent-only hrefs as primary nav', () => {
    const hrefs = ADMIN_SECTIONS.map((s) => adminSectionHref(s.section));
    for (const parentHref of PARENT_ONLY_NAV_HREFS) {
      assert.ok(
        !hrefs.includes(parentHref),
        `admin nav must not include ${parentHref}`,
      );
    }
  });
});

describe('Admin nav matrix — no cross-actor leakage', () => {
  const adminMain = getNavigationForDriverState('ADMIN').main.map((i) => i.href);
  const parentAll = [
    ...PARENT_NAV,
    ...PARENT_SECONDARY_NAV,
    ...getNavigationForDriverState('PARENT').main,
  ].map((i) => i.href);
  const driverAll = DRIVER_NAV.map((i) => i.href);
  const applicantAll = DRIVER_APPLICANT_NAV.map((i) => i.href);

  it('ADMIN global nav does not include family dashboard', () => {
    assert.ok(!adminMain.includes('/dashboard'));
  });

  it('PARENT nav excludes /admin', () => {
    assert.ok(!parentAll.some((h) => h === '/admin' || h.startsWith('/admin')));
  });

  it('DRIVER nav excludes /admin', () => {
    assert.ok(!driverAll.some((h) => h === '/admin'));
  });

  it('DRIVER_APPLICANT nav excludes /admin', () => {
    assert.ok(!applicantAll.some((h) => h === '/admin'));
  });
});

describe('Admin route defaults', () => {
  it('ADMIN default dashboard is /admin', () => {
    assert.equal(getDashboardPathForDriverState('ADMIN'), '/admin');
  });

  it('PARENT default dashboard is not /admin', () => {
    assert.notEqual(getDashboardPathForDriverState('PARENT'), '/admin');
  });
});

describe('Admin layout contract', () => {
  it('admin sections are single-nav source (no duplicate SectionRail)', () => {
    assert.ok(ADMIN_SECTIONS.length >= 10);
    assert.equal(
      new Set(ADMIN_SECTIONS.map((s) => s.section)).size,
      ADMIN_SECTIONS.length,
      'sections must be unique',
    );
  });
});
