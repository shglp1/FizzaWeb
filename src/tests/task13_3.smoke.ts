/**
 * Task 13.3 admin console completion smoke tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  calcPaginationRange,
  clampPageLimit,
  clientPaginationMeta,
  DEFAULT_ADMIN_PAGE_LIMIT,
  MAX_ADMIN_PAGE_LIMIT,
} from '../lib/ui/adminPagination.ts';
import { formatSar } from '../lib/ui/adminCurrency.ts';
import {
  formatRouteSummary,
  formatScheduleSummary,
  formatServiceDaysSummary,
} from '../lib/ui/subscriptionSummary.ts';
import {
  formatAuditAction,
  getAuditSeverity,
  auditActionsForSeverity,
} from '../lib/ui/adminAudit.ts';
import { ADMIN_SECTION_LABELS } from '../lib/adminNav.ts';
import { ADMIN_SIDEBAR_CLASSES } from '../lib/ui/adminSidebarLayout.ts';
import { OVERVIEW_KPI_CONFIG } from '../lib/ui/adminOverview.ts';
import { paymentsToCsv } from '../lib/ui/adminExport.ts';
import { DEFAULT_PAGE_LIMIT, buildPaginationMeta } from '../lib/pagination.ts';

describe('Task 13.3 — pagination utilities', () => {
  it('default admin page limit is 10', () => {
    assert.equal(DEFAULT_ADMIN_PAGE_LIMIT, 10);
    assert.equal(DEFAULT_PAGE_LIMIT, 10);
  });

  it('clampPageLimit respects max', () => {
    assert.equal(clampPageLimit(100), MAX_ADMIN_PAGE_LIMIT);
    assert.equal(clampPageLimit(0), 1);
    assert.equal(clampPageLimit(25), 25);
  });

  it('calcPaginationRange returns X–Y of Z', () => {
    assert.deepEqual(calcPaginationRange(1, 10, 45), { start: 1, end: 10, total: 45 });
    assert.deepEqual(calcPaginationRange(5, 10, 45), { start: 41, end: 45, total: 45 });
    assert.deepEqual(calcPaginationRange(1, 10, 0), { start: 0, end: 0, total: 0 });
  });

  it('buildPaginationMeta includes hasNext/hasPrev', () => {
    const meta = buildPaginationMeta(2, 10, 25);
    assert.equal(meta.hasNext, true);
    assert.equal(meta.hasPrev, true);
    assert.equal(meta.totalPages, 3);
  });

  it('clientPaginationMeta resets overflow page', () => {
    const meta = clientPaginationMeta(12, 99, 10);
    assert.equal(meta.page, 2);
    assert.equal(meta.totalPages, 2);
  });
});

describe('Task 13.3 — SAR formatting', () => {
  it('formatSar uses SAR X.XX', () => {
    assert.equal(formatSar(12), 'SAR 12.00');
    assert.equal(formatSar('9.5'), 'SAR 9.50');
  });
});

describe('Task 13.3 — subscription summary formatters', () => {
  it('formats route, schedule, and service days', () => {
    const sub = {
      pickupLocation: 'School A',
      dropoffLocation: 'Home B',
      tripDirection: 'ROUND_TRIP',
      pickupTime: '07:30',
      returnTime: '14:00',
      actualServiceDays: 22,
      schedules: [
        { weekday: 1, isOffDay: false },
        { weekday: 2, isOffDay: false },
        { weekday: 5, isOffDay: true },
      ],
    };
    assert.equal(formatRouteSummary(sub), 'School A → Home B');
    assert.match(formatScheduleSummary(sub), /Pickup 07:30/);
    assert.match(formatServiceDaysSummary(sub), /22 service days/);
  });
});

describe('Task 13.3 — audit formatter', () => {
  it('formats actions and severities', () => {
    assert.equal(formatAuditAction('PAYMENT_CREATED'), 'Payment created');
    assert.equal(getAuditSeverity('DRIVER_REJECTED'), 'danger');
    assert.ok(auditActionsForSeverity('success').includes('DRIVER_APPROVED'));
  });
});

describe('Task 13.3 — admin section labels', () => {
  it('includes overview label', () => {
    assert.equal(ADMIN_SECTION_LABELS.overview, 'Overview');
  });
});

describe('Task 13.3 — sidebar layout constants', () => {
  it('defines fixed sidebar shell classes', () => {
    assert.match(ADMIN_SIDEBAR_CLASSES.root, /fixed/);
    assert.match(ADMIN_SIDEBAR_CLASSES.root, /h-screen/);
    assert.match(ADMIN_SIDEBAR_CLASSES.nav, /overflow-y-auto/);
  });
});

describe('Task 13.3 — overview KPI config', () => {
  it('has 8 KPI entries', () => {
    assert.equal(OVERVIEW_KPI_CONFIG.length, 8);
    assert.ok(OVERVIEW_KPI_CONFIG.some((k) => k.key === 'chatFlags'));
  });
});

describe('Task 13.3 — financial CSV export', () => {
  it('exports SAR amounts in CSV', () => {
    const csv = paymentsToCsv([
      {
        user: { fullName: 'Parent One' },
        email: 'parent@example.com',
        purpose: 'Subscription',
        amountSar: 850.5,
        status: 'PAID',
        createdAt: '2026-05-24T10:00:00.000Z',
      },
    ]);
    assert.match(csv, /SAR 850\.50/);
    assert.match(csv, /Parent One/);
  });
});

describe('Task 13.3 — AdminPagination component exists', () => {
  it('AdminPagination.tsx is present', () => {
    const content = readFileSync(join(process.cwd(), 'src/components/admin/AdminPagination.tsx'), 'utf8');
    assert.match(content, /Showing/);
    assert.match(content, /Items per page/);
  });
});

describe('Task 13.3 — no emoji in new admin files', () => {
  it('new admin TSX files contain no emoji', () => {
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
    const files = [
      'src/components/admin/AdminPagination.tsx',
      'src/components/admin/AdminRowMenu.tsx',
      'src/app/admin/sections/OverviewSection.tsx',
    ];
    for (const file of files) {
      const content = readFileSync(join(process.cwd(), file), 'utf8');
      assert.ok(!emojiRe.test(content), `emoji found in ${file}`);
    }
  });
});
