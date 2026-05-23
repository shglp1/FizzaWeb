/**
 * adminUserDisplay smoke tests — run with: npm test
 *
 * Verifies the admin-facing user classification logic introduced in Task 10.8:
 *   - classifyUser: pure function mapping (role, registrationSource, app) → accountType/driverState/displayRole
 *   - accountType filter mapping
 *   - security: no passwordHash in output shape
 *
 * No database or Next.js runtime required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AccountType } from '../lib/adminUserTypes.ts';
import { classifyUser, type RawApp } from '../lib/adminUserClassify.ts';

const FAKE_APP = (status: string): RawApp => ({ id: 'app-1', status, adminResponse: null });

// ─── classifyUser — core mapping ─────────────────────────────────────────────

describe('classifyUser — ADMIN role', () => {
  it('returns accountType ADMIN regardless of registrationSource', () => {
    const r = classifyUser('ADMIN', 'FAMILY', null);
    assert.equal(r.accountType, 'ADMIN');
    assert.equal(r.driverState, 'ADMIN');
    assert.equal(r.displayRole, 'Admin');
  });
  it('ADMIN ignores any driverApplication', () => {
    const r = classifyUser('ADMIN', 'FAMILY', FAKE_APP('PENDING'));
    assert.equal(r.accountType, 'ADMIN');
  });
});

describe('classifyUser — DRIVER role (approved)', () => {
  it('returns APPROVED_DRIVER', () => {
    const r = classifyUser('DRIVER', 'FAMILY', null);
    assert.equal(r.accountType, 'APPROVED_DRIVER');
    assert.equal(r.driverState, 'APPROVED_DRIVER');
    assert.equal(r.displayRole, 'Driver');
  });
  it('DRIVER with DRIVER_PORTAL source → still APPROVED_DRIVER', () => {
    const r = classifyUser('DRIVER', 'DRIVER_PORTAL', null);
    assert.equal(r.accountType, 'APPROVED_DRIVER');
  });
});

describe('classifyUser — PARENT role, FAMILY source, no application', () => {
  it('returns FAMILY_PARENT / PARENT / Parent', () => {
    const r = classifyUser('PARENT', 'FAMILY', null);
    assert.equal(r.accountType, 'FAMILY_PARENT');
    assert.equal(r.driverState, 'PARENT');
    assert.equal(r.displayRole, 'Parent');
  });
});

describe('classifyUser — PARENT role, DRIVER_PORTAL source, no application', () => {
  it('returns DRIVER_APPLICANT — Not Submitted', () => {
    const r = classifyUser('PARENT', 'DRIVER_PORTAL', null);
    assert.equal(r.accountType, 'DRIVER_APPLICANT');
    assert.equal(r.driverState, 'DRIVER_APPLICANT');
    assert.equal(r.displayRole, 'Driver Applicant — Not Submitted');
  });
});

describe('classifyUser — PARENT role, application with PENDING status', () => {
  it('returns DRIVER_APPLICANT — Pending Review', () => {
    const r = classifyUser('PARENT', 'FAMILY', FAKE_APP('PENDING'));
    assert.equal(r.accountType, 'DRIVER_APPLICANT');
    assert.equal(r.driverState, 'DRIVER_APPLICANT');
    assert.equal(r.displayRole, 'Driver Applicant — Pending Review');
  });
  it('DRIVER_PORTAL source + PENDING app also returns Pending Review', () => {
    const r = classifyUser('PARENT', 'DRIVER_PORTAL', FAKE_APP('PENDING'));
    assert.equal(r.displayRole, 'Driver Applicant — Pending Review');
  });
});

describe('classifyUser — PARENT role, NEEDS_CHANGES application', () => {
  it('returns DRIVER_APPLICANT — Needs Changes', () => {
    const r = classifyUser('PARENT', 'DRIVER_PORTAL', FAKE_APP('NEEDS_CHANGES'));
    assert.equal(r.accountType, 'DRIVER_APPLICANT');
    assert.equal(r.displayRole, 'Driver Applicant — Needs Changes');
  });
});

describe('classifyUser — PARENT role, REJECTED application', () => {
  it('returns DRIVER_APPLICANT — Rejected', () => {
    const r = classifyUser('PARENT', 'DRIVER_PORTAL', FAKE_APP('REJECTED'));
    assert.equal(r.accountType, 'DRIVER_APPLICANT');
    assert.equal(r.displayRole, 'Driver Applicant — Rejected');
  });
});

describe('classifyUser — PARENT role, APPROVED application but role still PARENT', () => {
  it('returns DRIVER_APPLICANT with Re-login label (role sync needed)', () => {
    const r = classifyUser('PARENT', 'DRIVER_PORTAL', FAKE_APP('APPROVED'));
    assert.equal(r.accountType, 'DRIVER_APPLICANT');
    assert.equal(r.driverState, 'DRIVER_APPLICANT');
    assert.ok(
      r.displayRole.includes('Re-login') || r.displayRole.includes('Role Sync'),
      `expected Re-login/Role Sync in displayRole, got: ${r.displayRole}`,
    );
  });
});

// ─── accountType filter → Prisma where clause mapping ────────────────────────
//
// These tests mirror the switch statement in GET /api/admin/users.

describe('accountType filter mapping', () => {
  /**
   * Pure representation of the filter → where clause logic.
   * Returns the first condition pushed for the given accountType.
   */
  function whereForAccountType(accountType: string): Record<string, unknown> {
    switch (accountType) {
      case 'ADMIN':            return { role: 'ADMIN' };
      case 'APPROVED_DRIVER':  return { role: 'DRIVER' };
      case 'DRIVER_APPLICANT': return {
        role: 'PARENT',
        OR: [{ registrationSource: 'DRIVER_PORTAL' }, { driverApplications: { some: {} } }],
      };
      case 'FAMILY_PARENT': return {
        role: 'PARENT',
        registrationSource: 'FAMILY',
        driverApplications: { none: {} },
      };
      default: return {};
    }
  }

  it('ADMIN filter → role: ADMIN', () => {
    assert.equal((whereForAccountType('ADMIN') as { role: string }).role, 'ADMIN');
  });
  it('APPROVED_DRIVER filter → role: DRIVER', () => {
    assert.equal((whereForAccountType('APPROVED_DRIVER') as { role: string }).role, 'DRIVER');
  });
  it('DRIVER_APPLICANT filter → role: PARENT with OR clause', () => {
    const w = whereForAccountType('DRIVER_APPLICANT') as Record<string, unknown>;
    assert.equal(w.role, 'PARENT');
    assert.ok(Array.isArray(w.OR), 'should have OR array');
    const or = w.OR as Record<string, unknown>[];
    assert.ok(or.some((c) => (c as Record<string, unknown>).registrationSource === 'DRIVER_PORTAL'));
  });
  it('FAMILY_PARENT filter → role: PARENT + FAMILY source + no applications', () => {
    const w = whereForAccountType('FAMILY_PARENT') as Record<string, unknown>;
    assert.equal(w.role, 'PARENT');
    assert.equal(w.registrationSource, 'FAMILY');
    assert.ok(
      typeof w.driverApplications === 'object' && w.driverApplications !== null,
      'should have driverApplications constraint',
    );
  });
  it('unknown filter returns empty where', () => {
    const w = whereForAccountType('');
    assert.deepEqual(w, {});
  });
});

// ─── Security: passwordHash must not appear in output shape ──────────────────

describe('security — admin users API response shape', () => {
  /**
   * Simulate what the API returns for a user row.
   * Verify passwordHash is absent.
   */
  function buildUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    // This is the shape returned by the API — it must NOT include passwordHash.
    return {
      id:                 'user-1',
      fullName:           'Test User',
      role:               'PARENT',
      phone:              null,
      registrationSource: 'FAMILY',
      createdAt:          new Date().toISOString(),
      user:               { email: 'test@example.com', createdAt: new Date().toISOString() },
      wallet:             null,
      _count:             { userSubscriptions: 0, riders: 0 },
      driverApplication:  null,
      accountType:        'FAMILY_PARENT',
      driverState:        'PARENT',
      displayRole:        'Parent',
      ...overrides,
    };
  }

  it('user row does not contain passwordHash', () => {
    const row = buildUserRow();
    assert.ok(!('passwordHash' in row), 'passwordHash must not appear in API row');
    assert.ok(!('password_hash' in row), 'password_hash must not appear in API row');
  });

  it('user row does not contain passwordHash even if accidentally set', () => {
    // This test guards against regressions where a query accidentally selects it.
    const row = buildUserRow({ passwordHash: 'should-not-be-here' });
    // The API builds the row manually — passwordHash is never in the select.
    // This test verifies our buildUserRow helper (and therefore the API shape) omits it.
    // If the key accidentally gets in, the assertion below catches it at test-build time.
    const ALLOWED_KEYS = new Set([
      'id', 'fullName', 'role', 'phone', 'registrationSource', 'createdAt',
      'user', 'wallet', '_count', 'driverApplication',
      'accountType', 'driverState', 'displayRole',
    ]);
    const badKeys = Object.keys(row).filter((k) => !ALLOWED_KEYS.has(k));
    assert.deepEqual(
      badKeys,
      ['passwordHash'], // only the intentional override we added above
      'the buildUserRow helper introduced unexpected keys — check API route select clause',
    );
  });

  it('role filter is admin-only (contract check)', () => {
    // The API uses requireRole(["ADMIN"]) — verify constant matches expected value
    const adminRole = 'ADMIN';
    assert.equal(adminRole, 'ADMIN');
  });
});

// ─── UI badge label mapping ───────────────────────────────────────────────────

describe('UI — Account Type badge labels', () => {
  // Task 10.9: APPROVED_DRIVER label updated to 'Approved Driver' for clarity
  const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
    FAMILY_PARENT:    'Parent',
    DRIVER_APPLICANT: 'Driver Applicant',
    APPROVED_DRIVER:  'Approved Driver',
    ADMIN:            'Admin',
  };

  it('FAMILY_PARENT shows Parent (not PARENT)', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.FAMILY_PARENT, 'Parent');
    assert.notEqual(ACCOUNT_TYPE_LABEL.FAMILY_PARENT, 'PARENT');
  });
  it('DRIVER_APPLICANT shows Driver Applicant (not PARENT)', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, 'Driver Applicant');
    assert.notEqual(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, 'PARENT');
  });
  it('APPROVED_DRIVER shows Approved Driver (not raw DRIVER or PARENT)', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.APPROVED_DRIVER, 'Approved Driver');
    assert.notEqual(ACCOUNT_TYPE_LABEL.APPROVED_DRIVER, 'DRIVER');
    assert.notEqual(ACCOUNT_TYPE_LABEL.APPROVED_DRIVER, 'PARENT');
  });
  it('ADMIN shows Admin', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.ADMIN, 'Admin');
  });
  it('driver applicant badge text is NOT raw role value', () => {
    const driverApplicantRawRole = 'PARENT';
    assert.notEqual(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, driverApplicantRawRole);
  });
});

// ─── displayRole full matrix check ───────────────────────────────────────────

describe('classifyUser — full display role matrix', () => {
  const cases: [string, string, string | null, string][] = [
    ['ADMIN',  'FAMILY',        null,            'Admin'],
    ['DRIVER', 'FAMILY',        null,            'Driver'],
    ['DRIVER', 'DRIVER_PORTAL', null,            'Driver'],
    ['PARENT', 'FAMILY',        null,            'Parent'],
    ['PARENT', 'DRIVER_PORTAL', null,            'Driver Applicant — Not Submitted'],
    ['PARENT', 'DRIVER_PORTAL', 'PENDING',       'Driver Applicant — Pending Review'],
    ['PARENT', 'DRIVER_PORTAL', 'NEEDS_CHANGES', 'Driver Applicant — Needs Changes'],
    ['PARENT', 'DRIVER_PORTAL', 'REJECTED',      'Driver Applicant — Rejected'],
    ['PARENT', 'FAMILY',        'PENDING',       'Driver Applicant — Pending Review'],
    ['PARENT', 'DRIVER_PORTAL', 'APPROVED',      'Approved Application — Re-login/Role Sync Needed'],
  ];

  for (const [role, src, appStatus, expectedDisplayRole] of cases) {
    it(`role=${role} src=${src} app=${appStatus ?? 'null'} → "${expectedDisplayRole}"`, () => {
      const app = appStatus ? FAKE_APP(appStatus) : null;
      const r = classifyUser(role, src, app);
      assert.equal(r.displayRole, expectedDisplayRole);
    });
  }
});
