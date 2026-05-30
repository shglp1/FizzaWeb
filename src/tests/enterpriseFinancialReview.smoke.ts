/**
 * Admin financial review queue smoke tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_SECTION_LABELS } from '../lib/adminNav.ts';
import {
  isTripPayrollEligible,
  getPayrollSkipReason,
} from '../lib/trips/tripClassification.ts';

const finSection = readFileSync(
  join(process.cwd(), 'src/app/admin/sections/FinancialReviewSection.tsx'),
  'utf8',
);
const finPanel = readFileSync(
  join(process.cwd(), 'src/components/admin/TripFinancialReviewPanel.tsx'),
  'utf8',
);

test('financial review admin section exists in nav', () => {
  assert.equal(ADMIN_SECTION_LABELS['financial-review'], 'Financial Review');
});

test('financial review section has pending and payment action tabs', () => {
  assert.ok(finSection.includes('Pending review'));
  assert.ok(finSection.includes('Payment action required'));
  assert.ok(finSection.includes('financialReviewStatus: \'PENDING\''));
  assert.ok(finSection.includes('paymentActionRequired: true'));
  assert.ok(finSection.includes('Automated internal wallet credit'));
});

test('refund shows manual gateway action; credit is automated in panel', () => {
  assert.ok(finPanel.includes('Payment gateway refund'));
  assert.ok(finPanel.includes('Wallet credit processed'));
  assert.ok(finPanel.includes('Credit parent wallet (automated)'));
});

test('all payroll skip statuses', () => {
  const base = {
    status: 'COMPLETED',
    scheduledDate: '2026-05-29',
    scheduledPickupTime: '2026-05-29T04:10:00.000Z',
  };
  for (const status of ['PENDING', 'NO_PAY_DRIVER', 'REFUND_PARENT', 'CREDIT_PARENT', 'INCIDENT'] as const) {
    assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: status }), false);
    assert.ok(getPayrollSkipReason({ ...base, financialReviewStatus: status }).length > 0);
  }
});

test('PAY_DRIVER and clean completed are payroll eligible', () => {
  const base = {
    status: 'COMPLETED',
    scheduledDate: '2026-05-29',
    scheduledPickupTime: '2026-05-29T04:10:00.000Z',
  };
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'PAY_DRIVER' }), true);
  assert.equal(isTripPayrollEligible(base), true);
});
