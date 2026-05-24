/**
 * Task 14.1 — Payroll enterprise follow-up smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { getBillableKmSync } from '../lib/payroll/getBillableKm.ts';
import { payrollLinesToCsv } from '../lib/payroll/payrollExport.ts';

test('manual km override takes precedence over coordinates', () => {
  const km = getBillableKmSync({
    pickupLat: 24.7,
    pickupLng: 46.6,
    dropoffLat: 24.8,
    dropoffLng: 46.7,
    billableKmOverride: 12.5,
  });
  assert.ok(km);
  assert.equal(km.kmSource, 'MANUAL');
  assert.equal(km.billableKm, 12.5);
});

test('payroll CSV export includes driver net pay columns', () => {
  const csv = payrollLinesToCsv([
    {
      driverName: 'Ahmed',
      driverEmail: 'a@test.com',
      tripCount: 3,
      totalBillableKm: 45,
      grossSar: 90,
      platformFeeSar: 13.5,
      tripNetSar: 76.5,
      deductionsSar: 0,
      bonusesSar: 5,
      netPaySar: 81.5,
      status: 'APPROVED',
      payoutMethod: 'MYFATOORAH',
      payoutRef: '12345',
    },
  ]);
  assert.match(csv, /Driver,Email/);
  assert.match(csv, /Ahmed/);
  assert.match(csv, /MYFATOORAH/);
});

test('MyFatoorah multi-vendor helper exists', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/payments/myfatoorahSuppliers.ts'), 'utf8');
  assert.match(src, /isMultiVendorConfigured/);
  assert.match(src, /transferBalance/);
});

test('payroll cron and payout API routes exist', () => {
  const root = process.cwd();
  assert.ok(readFileSync(join(root, 'src/app/api/cron/payroll/generate/route.ts'), 'utf8').includes('generatePreviousMonthPayrollCron'));
  assert.ok(readFileSync(join(root, 'src/app/api/driver/payout-profile/route.ts'), 'utf8').includes('bankIban'));
  assert.ok(readFileSync(join(root, 'src/lib/payments/myfatoorahSuppliers.ts'), 'utf8').includes('transferBalance'));
  assert.ok(readFileSync(join(root, 'src/app/api/admin/payroll/export/route.ts'), 'utf8').includes('payrollLinesToCsv'));
});

test('prisma schema includes payout and km override fields', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /billableKmOverride/);
  assert.match(schema, /myfatoorahSupplierCode/);
  assert.match(schema, /payoutMethod/);
  assert.match(schema, /skippedTrips/);
});

test('vercel cron includes monthly payroll generation', () => {
  const vercel = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8');
  assert.match(vercel, /cron\/payroll\/generate/);
});
