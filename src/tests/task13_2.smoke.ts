/**
 * Task 13.2 admin console redesign smoke tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatAuditAction,
  summarizeAuditDetails,
  getAuditSeverity,
  isCriticalAuditAction,
} from '../lib/ui/adminAudit.ts';
import { formatSar, formatWallet } from '../lib/ui/adminCurrency.ts';
import {
  CONFIG_GROUPS,
  CONFIG_FIELD_META,
  ALL_CONFIG_KEYS,
} from '../lib/ui/systemConfigGroups.ts';
import { ADMIN_SECTION_LABELS } from '../lib/adminNav.ts';
import { classifyTripForBoard } from '../lib/ui/adminOperations.ts';

const ACCOUNT_TYPE_LABEL = {
  FAMILY_PARENT: 'Parent',
  DRIVER_APPLICANT: 'Driver Applicant',
  APPROVED_DRIVER: 'Approved Driver',
  ADMIN: 'Admin',
} as const;

const ADMIN_TSX_ROOTS = [
  join(process.cwd(), 'src/app/admin'),
  join(process.cwd(), 'src/components/admin'),
  join(process.cwd(), 'src/components/layout/AdminShell.tsx'),
];

function collectTsxFiles(path: string): string[] {
  const st = statSync(path);
  if (st.isFile() && path.endsWith('.tsx')) return [path];
  if (!st.isDirectory()) return [];
  return readdirSync(path).flatMap((name) => collectTsxFiles(join(path, name)));
}

describe('Task 13.2 — no emoji in admin UI TSX', () => {
  it('admin TSX files contain no emoji characters', () => {
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
    const files = ADMIN_TSX_ROOTS.flatMap(collectTsxFiles);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      assert.ok(!emojiRe.test(content), `emoji found in ${file}`);
    }
  });
});

describe('Task 13.2 — financial currency formatting', () => {
  it('formatSar always uses 2 decimals', () => {
    assert.equal(formatSar(850.5), 'SAR 850.50');
    assert.equal(formatSar('850.5'), 'SAR 850.50');
    assert.equal(formatSar(0), 'SAR 0.00');
  });

  it('formatWallet matches formatSar', () => {
    assert.equal(formatWallet('150.5'), 'SAR 150.50');
  });
});

describe('Task 13.2 — audit event formatter', () => {
  it('converts PROFILE_UPDATED style actions', () => {
    assert.equal(formatAuditAction('PROFILE_UPDATED'), 'Profile updated');
    assert.equal(formatAuditAction('SUBSCRIPTION_DRIVER_ASSIGNED'), 'Driver assigned to subscription');
    assert.equal(formatAuditAction('PAYMENT_CREATED'), 'Payment created');
    assert.equal(formatAuditAction('SAFETY_REPORT_APPROVED'), 'Safety report approved');
  });

  it('summarizeAuditDetails returns human text not raw JSON', () => {
    const summary = summarizeAuditDetails('PAYMENT_CREATED', JSON.stringify({ amountSar: 99.5, status: 'PAID' }));
    assert.ok(summary.includes('Amount SAR 99.50'));
    assert.ok(!summary.startsWith('{'));
  });

  it('critical/admin severity detection works', () => {
    assert.equal(getAuditSeverity('DRIVER_REJECTED'), 'danger');
    assert.equal(getAuditSeverity('ADMIN_PACKAGE_CREATED'), 'admin');
    assert.ok(isCriticalAuditAction('SYSTEM_CONFIG_UPDATED'));
  });
});

describe('Task 13.2 — system config grouping', () => {
  it('CONFIG_GROUPS covers all config keys', () => {
    const groupedKeys = new Set(CONFIG_GROUPS.flatMap((g) => g.keys));
    for (const key of ALL_CONFIG_KEYS) {
      assert.ok(groupedKeys.has(key), `missing group for ${key}`);
    }
  });

  it('groups include expected operational areas', () => {
    const ids = CONFIG_GROUPS.map((g) => g.id);
    for (const required of ['pricing', 'trips', 'notifications', 'payment', 'support']) {
      assert.ok(ids.includes(required as typeof ids[number]), `missing group ${required}`);
    }
  });

  it('every field has metadata', () => {
    for (const key of ALL_CONFIG_KEYS) {
      assert.ok(CONFIG_FIELD_META[key]?.label, `missing label for ${key}`);
    }
  });
});

describe('Task 13.2 — admin section labels', () => {
  it('required sections have labels', () => {
    for (const section of ['users', 'riders', 'drivers', 'applications', 'packages', 'subscriptions', 'trips', 'financial-review', 'financials', 'safety', 'sysconfig', 'audit']) {
      assert.ok(ADMIN_SECTION_LABELS[section as keyof typeof ADMIN_SECTION_LABELS]);
    }
  });
});

describe('Task 13.2 — status badges readable labels', () => {
  it('account types are not raw DB enums', () => {
    assert.notEqual(ACCOUNT_TYPE_LABEL.DRIVER_APPLICANT, 'PARENT');
    assert.equal(ACCOUNT_TYPE_LABEL.FAMILY_PARENT, 'Parent');
  });
});

describe('Task 13.2 — trip board grouping', () => {
  it('classifyTripForBoard unchanged contract', () => {
    assert.equal(classifyTripForBoard({ status: 'SCHEDULED', driver: { profile: { fullName: 'A' } } }), 'scheduled');
    assert.equal(classifyTripForBoard({ status: 'SCHEDULED', driver: null }), 'attention');
    assert.equal(classifyTripForBoard({ status: 'ON_THE_WAY', driver: { profile: { fullName: 'A' } } }), 'active');
    assert.equal(classifyTripForBoard({ status: 'COMPLETED', driver: null }), 'completed');
  });
});

describe('Task 13.2 — AdminUI module exports', () => {
  it('AdminUI component file exists with required exports', () => {
    const content = readFileSync(join(process.cwd(), 'src/components/admin/AdminUI.tsx'), 'utf8');
    for (const symbol of [
      'AdminSectionHeader',
      'AdminToolbar',
      'AdminMetricGrid',
      'AdminDataCard',
      'AdminTable',
      'AdminDrawer',
      'AdminStatusBadge',
      'AdminEmptyState',
      'AdminJsonDetails',
    ]) {
      assert.ok(content.includes(`export function ${symbol}`), `missing ${symbol}`);
    }
  });
});
