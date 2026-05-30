/**
 * Enterprise platform payroll eligibility smoke tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTripPayrollEligible,
  getPayrollSkipReason,
} from '../lib/trips/tripClassification.ts';

const may29 = '2026-05-29';
const base = {
  status: 'COMPLETED',
  scheduledDate: may29,
  scheduledPickupTime: `${may29}T04:10:00.000Z`,
};

test('PAY_DRIVER is payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'PAY_DRIVER' }), true);
});

test('KEEP_REVENUE is payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'KEEP_REVENUE' }), true);
});

test('PENDING is not payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'PENDING' }), false);
  assert.match(getPayrollSkipReason({ ...base, financialReviewStatus: 'PENDING' }), /Financial review pending/);
});

test('NO_PAY_DRIVER is not payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'NO_PAY_DRIVER' }), false);
});

test('REFUND_PARENT is not payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'REFUND_PARENT' }), false);
  assert.match(getPayrollSkipReason({ ...base, financialReviewStatus: 'REFUND_PARENT' }), /refund parent/i);
});

test('CREDIT_PARENT is not payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'CREDIT_PARENT' }), false);
});

test('INCIDENT is not payroll eligible', () => {
  assert.equal(isTripPayrollEligible({ ...base, financialReviewStatus: 'INCIDENT' }), false);
});

test('normal completed trip without review is payable', () => {
  assert.equal(isTripPayrollEligible(base), true);
  assert.equal(getPayrollSkipReason(base), '');
});
