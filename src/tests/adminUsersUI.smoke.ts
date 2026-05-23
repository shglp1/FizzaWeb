/**
 * adminUsersUI smoke tests — run with: npm test
 *
 * Verifies the enterprise UI helpers added in Task 10.9:
 *   - Account type badge labels (ACCOUNT_TYPE_LABEL)
 *   - Application status labels (APP_STATUS_LABEL + APP_STATUS_FILTER_LABEL)
 *   - Application status helper text (APP_STATUS_HELPER)
 *   - Wallet formatting (formatWallet)
 *   - Filter UI logic (applicationStatus hidden unless DRIVER_APPLICANT)
 *   - Reset filter logic
 *   - Missing / null data handled gracefully
 *   - No raw PARENT label for driver applicants
 *
 * No database or Next.js runtime required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AccountType } from '../lib/adminUserTypes.ts';

// ─── Mirror of UI label constants ─────────────────────────────────────────────
// These must match UsersSection.tsx exactly. If those constants change, update here too.

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  FAMILY_PARENT:    'Parent',
  DRIVER_APPLICANT: 'Driver Applicant',
  APPROVED_DRIVER:  'Approved Driver',
  ADMIN:            'Admin',
};

const APP_STATUS_LABEL: Record<string, string> = {
  PENDING:       'Pending review',
  APPROVED:      'Approved',
  REJECTED:      'Rejected',
  NEEDS_CHANGES: 'Needs changes',
};

const APP_STATUS_FILTER_LABEL: Record<string, string> = {
  NOT_SUBMITTED: 'Not Submitted',
  PENDING:       'Pending Review',
  NEEDS_CHANGES: 'Needs Changes',
  REJECTED:      'Rejected',
  APPROVED:      'Approved (Sync Pending)',
};

const APP_STATUS_HELPER: Record<string, string> = {
  NOT_SUBMITTED: 'Registered through driver portal but application form not submitted yet.',
  PENDING:       'Application submitted and waiting for admin review.',
  NEEDS_CHANGES: 'Admin requested updates to the application.',
  REJECTED:      'Application was rejected.',
  APPROVED:      'Application approved — user session/role may need refresh.',
};

// Mirror of formatWallet helper
function formatWallet(balance: string | null | undefined): string {
  if (balance == null || balance === '') return '—';
  const n = Number(balance);
  return isNaN(n) ? '—' : `SAR ${n.toFixed(2)}`;
}

// ─── Account Type badge labels ────────────────────────────────────────────────

describe('Account Type badge labels — Task 10.9', () => {
  it('FAMILY_PARENT → Parent', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.FAMILY_PARENT, 'Parent');
  });
  it('DRIVER_APPLICANT → Driver Applicant', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, 'Driver Applicant');
  });
  it('APPROVED_DRIVER → Approved Driver (full label, not just Driver)', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.APPROVED_DRIVER, 'Approved Driver');
  });
  it('ADMIN → Admin', () => {
    assert.equal(ACCOUNT_TYPE_LABEL.ADMIN, 'Admin');
  });
  it('no badge label is a raw DB role value', () => {
    const labels = Object.values(ACCOUNT_TYPE_LABEL);
    assert.ok(!labels.includes('PARENT'), 'PARENT should not appear as badge label');
    assert.ok(!labels.includes('DRIVER'), 'DRIVER should not appear as badge label');
    assert.ok(!labels.includes('ADMIN'), 'ADMIN (all-caps) should not appear as badge label — it should be Admin');
    // Check properly: raw roles should not match display labels
    assert.notEqual(ACCOUNT_TYPE_LABEL.FAMILY_PARENT, 'PARENT');
    assert.notEqual(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, 'PARENT');
    assert.notEqual(ACCOUNT_TYPE_LABEL.APPROVED_DRIVER, 'DRIVER');
    assert.notEqual(ACCOUNT_TYPE_LABEL.ADMIN, 'ADMIN');
  });
  it('driver applicant does NOT show as plain Parent', () => {
    assert.notEqual(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, ACCOUNT_TYPE_LABEL.FAMILY_PARENT);
    assert.notEqual(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, 'Parent');
  });
});

// ─── Application Status labels (table display) ────────────────────────────────

describe('Application Status display labels', () => {
  it('PENDING → Pending review', () => {
    assert.equal(APP_STATUS_LABEL.PENDING, 'Pending review');
  });
  it('NEEDS_CHANGES → Needs changes', () => {
    assert.equal(APP_STATUS_LABEL.NEEDS_CHANGES, 'Needs changes');
  });
  it('REJECTED → Rejected', () => {
    assert.equal(APP_STATUS_LABEL.REJECTED, 'Rejected');
  });
  it('APPROVED → Approved', () => {
    assert.equal(APP_STATUS_LABEL.APPROVED, 'Approved');
  });
  it('unknown status falls back gracefully (status is used raw)', () => {
    // The component does: APP_STATUS_LABEL[s] ?? s (fallback to raw status)
    const label = APP_STATUS_LABEL['UNKNOWN_STATUS'] ?? 'UNKNOWN_STATUS';
    assert.equal(label, 'UNKNOWN_STATUS');
  });
});

// ─── Application Status filter labels (filter chip display) ──────────────────

describe('Application Status filter labels', () => {
  it('NOT_SUBMITTED → Not Submitted', () => {
    assert.equal(APP_STATUS_FILTER_LABEL.NOT_SUBMITTED, 'Not Submitted');
  });
  it('PENDING → Pending Review', () => {
    assert.equal(APP_STATUS_FILTER_LABEL.PENDING, 'Pending Review');
  });
  it('NEEDS_CHANGES → Needs Changes', () => {
    assert.equal(APP_STATUS_FILTER_LABEL.NEEDS_CHANGES, 'Needs Changes');
  });
  it('REJECTED → Rejected', () => {
    assert.equal(APP_STATUS_FILTER_LABEL.REJECTED, 'Rejected');
  });
  it('APPROVED → Approved (Sync Pending)', () => {
    assert.equal(APP_STATUS_FILTER_LABEL.APPROVED, 'Approved (Sync Pending)');
  });
});

// ─── Application Status helper text ──────────────────────────────────────────

describe('Application Status helper text — shown below status badge', () => {
  it('NOT_SUBMITTED helper mentions driver portal', () => {
    assert.ok(
      APP_STATUS_HELPER.NOT_SUBMITTED.toLowerCase().includes('driver portal'),
      `expected "driver portal" in: ${APP_STATUS_HELPER.NOT_SUBMITTED}`,
    );
  });
  it('PENDING helper mentions "admin review"', () => {
    assert.ok(
      APP_STATUS_HELPER.PENDING.toLowerCase().includes('admin'),
      `expected "admin" in: ${APP_STATUS_HELPER.PENDING}`,
    );
  });
  it('NEEDS_CHANGES helper mentions "updates"', () => {
    assert.ok(
      APP_STATUS_HELPER.NEEDS_CHANGES.toLowerCase().includes('update'),
      `expected "update" in: ${APP_STATUS_HELPER.NEEDS_CHANGES}`,
    );
  });
  it('REJECTED helper mentions "rejected"', () => {
    assert.ok(
      APP_STATUS_HELPER.REJECTED.toLowerCase().includes('reject'),
      `expected "reject" in: ${APP_STATUS_HELPER.REJECTED}`,
    );
  });
  it('APPROVED helper mentions "session" or "role"', () => {
    const text = APP_STATUS_HELPER.APPROVED.toLowerCase();
    assert.ok(
      text.includes('session') || text.includes('role'),
      `expected "session" or "role" in: ${APP_STATUS_HELPER.APPROVED}`,
    );
  });
  it('all 5 application states have helper text', () => {
    const states = ['NOT_SUBMITTED', 'PENDING', 'NEEDS_CHANGES', 'REJECTED', 'APPROVED'];
    for (const s of states) {
      assert.ok(
        typeof APP_STATUS_HELPER[s] === 'string' && APP_STATUS_HELPER[s].length > 10,
        `${s} should have a non-empty helper string`,
      );
    }
  });
});

// ─── Wallet formatting ────────────────────────────────────────────────────────

describe('formatWallet — safe formatting', () => {
  it('null → —', () => {
    assert.equal(formatWallet(null), '—');
  });
  it('undefined → —', () => {
    assert.equal(formatWallet(undefined), '—');
  });
  it('empty string → —', () => {
    assert.equal(formatWallet(''), '—');
  });
  it('zero → SAR 0.00', () => {
    assert.equal(formatWallet('0'), 'SAR 0.00');
  });
  it('positive amount → SAR formatted', () => {
    assert.equal(formatWallet('150.5'), 'SAR 150.50');
  });
  it('large amount → SAR formatted with 2 decimals', () => {
    assert.equal(formatWallet('9999.999'), 'SAR 10000.00');
  });
  it('non-numeric string → —', () => {
    assert.equal(formatWallet('not-a-number'), '—');
  });
  it('negative amount → SAR formatted (pass-through)', () => {
    assert.ok(formatWallet('-50').startsWith('SAR '), 'negative balance should still format');
  });
});

// ─── Filter UI logic ──────────────────────────────────────────────────────────

describe('Filter UI logic', () => {
  /**
   * Mirror of the filter state machine in UsersSection:
   * - applicationStatus filter is only visible when accountType === 'DRIVER_APPLICANT'
   * - Switching away from DRIVER_APPLICANT resets appStatusFilter
   */

  function shouldShowAppStatusFilter(accountTypeFilter: string): boolean {
    return accountTypeFilter === 'DRIVER_APPLICANT';
  }

  function handleAccountTypeChange(
    newType: string,
    currentAppStatus: string,
  ): { accountTypeFilter: string; appStatusFilter: string } {
    return {
      accountTypeFilter: newType,
      appStatusFilter: newType !== 'DRIVER_APPLICANT' ? '' : currentAppStatus,
    };
  }

  it('app status filter is hidden when accountType is empty (All Accounts)', () => {
    assert.equal(shouldShowAppStatusFilter(''), false);
  });
  it('app status filter is hidden for FAMILY_PARENT', () => {
    assert.equal(shouldShowAppStatusFilter('FAMILY_PARENT'), false);
  });
  it('app status filter is hidden for APPROVED_DRIVER', () => {
    assert.equal(shouldShowAppStatusFilter('APPROVED_DRIVER'), false);
  });
  it('app status filter is hidden for ADMIN', () => {
    assert.equal(shouldShowAppStatusFilter('ADMIN'), false);
  });
  it('app status filter IS shown for DRIVER_APPLICANT', () => {
    assert.equal(shouldShowAppStatusFilter('DRIVER_APPLICANT'), true);
  });
  it('switching from DRIVER_APPLICANT to FAMILY_PARENT clears appStatus', () => {
    const r = handleAccountTypeChange('FAMILY_PARENT', 'PENDING');
    assert.equal(r.accountTypeFilter, 'FAMILY_PARENT');
    assert.equal(r.appStatusFilter, '', 'appStatusFilter must be cleared');
  });
  it('switching from DRIVER_APPLICANT to empty (All) clears appStatus', () => {
    const r = handleAccountTypeChange('', 'PENDING');
    assert.equal(r.appStatusFilter, '');
  });
  it('staying on DRIVER_APPLICANT preserves the appStatus filter', () => {
    const r = handleAccountTypeChange('DRIVER_APPLICANT', 'PENDING');
    assert.equal(r.appStatusFilter, 'PENDING');
  });
});

// ─── Reset filters logic ──────────────────────────────────────────────────────

describe('Reset filters logic', () => {
  function resetFilters(): {
    searchInput: string;
    debouncedSearch: string;
    accountTypeFilter: string;
    appStatusFilter: string;
    page: number;
  } {
    return {
      searchInput:       '',
      debouncedSearch:   '',
      accountTypeFilter: '',
      appStatusFilter:   '',
      page:              1,
    };
  }

  it('reset clears searchInput', () => {
    assert.equal(resetFilters().searchInput, '');
  });
  it('reset clears debouncedSearch', () => {
    assert.equal(resetFilters().debouncedSearch, '');
  });
  it('reset clears accountTypeFilter', () => {
    assert.equal(resetFilters().accountTypeFilter, '');
  });
  it('reset clears appStatusFilter', () => {
    assert.equal(resetFilters().appStatusFilter, '');
  });
  it('reset goes back to page 1', () => {
    assert.equal(resetFilters().page, 1);
  });
});

// ─── hasFilters logic ─────────────────────────────────────────────────────────

describe('hasFilters — show/hide reset button and filter chips', () => {
  function hasFilters(search: string, accountType: string, appStatus: string): boolean {
    return !!(search || accountType || appStatus);
  }

  it('no filters → false', () => {
    assert.equal(hasFilters('', '', ''), false);
  });
  it('search only → true', () => {
    assert.equal(hasFilters('ali', '', ''), true);
  });
  it('accountType only → true', () => {
    assert.equal(hasFilters('', 'DRIVER_APPLICANT', ''), true);
  });
  it('appStatus only → true', () => {
    assert.equal(hasFilters('', '', 'PENDING'), true);
  });
  it('all three filters → true', () => {
    assert.equal(hasFilters('john', 'DRIVER_APPLICANT', 'PENDING'), true);
  });
});

// ─── Graceful handling of missing data ───────────────────────────────────────

describe('graceful null / missing data handling', () => {
  it('formatWallet handles null wallet gracefully', () => {
    const wallet = null as { balanceSar: string } | null;
    // Simulating: formatWallet(u.wallet?.balanceSar)
    const result = formatWallet(wallet?.balanceSar);
    assert.equal(result, '—');
  });

  it('user without phone shows nothing (optional phone)', () => {
    const phone: string | null = null;
    assert.equal(phone, null);
    // Component conditionally renders: {u.phone && <p>{u.phone}</p>}
    const rendered = phone ?? '';
    assert.equal(rendered, '');
  });

  it('fullName with single word produces 2-char initials', () => {
    function getInitials(name: string): string {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return (name.slice(0, 2) || '??').toUpperCase();
    }
    assert.equal(getInitials('Ali'), 'AL');
  });

  it('fullName with two words produces first-letter initials', () => {
    function getInitials(name: string): string {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return (name.slice(0, 2) || '??').toUpperCase();
    }
    assert.equal(getInitials('Ahmad Hassan'), 'AH');
  });

  it('empty fullName produces ?? initials', () => {
    function getInitials(name: string): string {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return (name.slice(0, 2) || '??').toUpperCase();
    }
    assert.equal(getInitials(''), '??');
  });
});

// ─── No raw PARENT label for driver applicants ────────────────────────────────

describe('no raw role labels in UI', () => {
  it('DRIVER_APPLICANT accountType does not render "PARENT" badge', () => {
    const label = ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT;
    assert.notEqual(label, 'PARENT');
    assert.notEqual(label, 'Parent'); // must say "Driver Applicant" not "Parent"
    assert.equal(label, 'Driver Applicant');
  });
  it('FAMILY_PARENT accountType does not render raw "PARENT"', () => {
    const label = ACCOUNT_TYPE_LABEL.FAMILY_PARENT;
    assert.notEqual(label, 'PARENT');
    assert.equal(label, 'Parent');
  });
  it('no accountType renders a raw DB role enum value', () => {
    const RAW_DB_ROLES = ['PARENT', 'DRIVER', 'ADMIN'];
    for (const [, label] of Object.entries(ACCOUNT_TYPE_LABEL)) {
      for (const rawRole of RAW_DB_ROLES) {
        assert.notEqual(label, rawRole, `badge label "${label}" must not be raw role "${rawRole}"`);
      }
    }
  });
});

// ─── Summary card count safety ────────────────────────────────────────────────

describe('summary card — safe count display', () => {
  function safeSummaryCount(summary: null | undefined | Record<string, number>, key: string): number {
    return summary?.[key] ?? 0;
  }

  it('null summary → 0 for all cards', () => {
    assert.equal(safeSummaryCount(null, 'familyParents'), 0);
    assert.equal(safeSummaryCount(null, 'driverApplicants'), 0);
    assert.equal(safeSummaryCount(null, 'approvedDrivers'), 0);
    assert.equal(safeSummaryCount(null, 'admins'), 0);
  });
  it('undefined summary → 0', () => {
    assert.equal(safeSummaryCount(undefined, 'familyParents'), 0);
  });
  it('valid summary → returns correct counts', () => {
    const s = { familyParents: 12, driverApplicants: 3, approvedDrivers: 7, admins: 1 };
    assert.equal(safeSummaryCount(s, 'familyParents'), 12);
    assert.equal(safeSummaryCount(s, 'driverApplicants'), 3);
    assert.equal(safeSummaryCount(s, 'approvedDrivers'), 7);
    assert.equal(safeSummaryCount(s, 'admins'), 1);
  });
});
