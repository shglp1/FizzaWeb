/**
 * Task 14 — Trip-based driver payroll smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  calculatePeriodNetPay,
  calculateTripEarning,
  roundKm,
  roundMoney,
} from '../lib/payroll/calculateTripEarning.ts';
import { getBillableKmSync } from '../lib/payroll/getBillableKm.ts';
import {
  DEFAULT_DRIVER_PAY_RATE_PER_KM,
  DEFAULT_DRIVER_PLATFORM_FEE_PERCENT,
  resolveDriverPayRules,
} from '../lib/payroll/payRules.ts';
import { ADMIN_SECTIONS, ADMIN_SECTION_LABELS } from '../lib/adminNav.ts';
import { DRIVER_NAV, getNavigationForRole, isRouteAllowedForRole } from '../lib/roleRoutes.ts';
import { getMobileNavItemsForDriverState } from '../lib/mobileNav.ts';
import { CONFIG_FIELD_META, CONFIG_GROUPS } from '../lib/ui/systemConfigGroups.ts';

test('trip earning formula: km × rate minus platform fee', () => {
  const result = calculateTripEarning({
    billableKm: 10,
    ratePerKmSar: 2,
    platformFeePercent: 15,
  });
  assert.equal(result.grossSar, 20);
  assert.equal(result.platformFeeSar, 3);
  assert.equal(result.netSar, 17);
});

test('period net pay applies deductions and bonuses', () => {
  assert.equal(calculatePeriodNetPay({ tripNetSar: 100, deductionsSar: 10, bonusesSar: 5 }), 95);
});

test('money and km rounding', () => {
  assert.equal(roundMoney(10.556), 10.56);
  assert.equal(roundKm(12.3456), 12.346);
});

test('haversine billable km from trip coordinates', () => {
  const riyadh = { pickupLat: 24.7136, pickupLng: 46.6753, dropoffLat: 24.7743, dropoffLng: 46.7386 };
  const km = getBillableKmSync(riyadh);
  assert.ok(km);
  assert.equal(km.kmSource, 'HAVERSINE');
  assert.ok(km.billableKm > 5 && km.billableKm < 15);
});

test('resolve driver pay rules with optional overrides', () => {
  const global = { ratePerKmSar: 2, platformFeePercent: 10 };
  assert.deepEqual(resolveDriverPayRules(global, null), global);
  assert.deepEqual(
    resolveDriverPayRules(global, { ratePerKmSar: 2.5, platformFeePercent: null }),
    { ratePerKmSar: 2.5, platformFeePercent: 10 },
  );
});

test('default pay rule constants are sensible', () => {
  assert.ok(DEFAULT_DRIVER_PAY_RATE_PER_KM > 0);
  assert.ok(DEFAULT_DRIVER_PLATFORM_FEE_PERCENT >= 0 && DEFAULT_DRIVER_PLATFORM_FEE_PERCENT <= 100);
});

test('admin nav includes payroll section', () => {
  assert.ok(ADMIN_SECTIONS.some((s) => s.section === 'payroll'));
  assert.equal(ADMIN_SECTION_LABELS.payroll, 'Driver Payroll');
});

test('driver nav includes earnings route', () => {
  assert.ok(DRIVER_NAV.some((i) => i.href === '/driver/earnings' && i.label === 'Earnings'));
  const nav = getNavigationForRole('DRIVER');
  assert.ok(nav.main.some((i) => i.href === '/driver/earnings'));
  assert.ok(isRouteAllowedForRole('/driver/earnings', 'DRIVER'));
});

test('mobile nav includes earnings for approved driver', () => {
  const items = getMobileNavItemsForDriverState('APPROVED_DRIVER')!;
  assert.ok(items.some((i) => i.href === '/driver/earnings'));
});

test('system config includes driver payroll keys', () => {
  assert.ok(CONFIG_FIELD_META.driverPayRatePerKmSar);
  assert.ok(CONFIG_FIELD_META.driverPlatformFeePercent);
  const payrollGroup = CONFIG_GROUPS.find((g) => g.id === 'payroll');
  assert.ok(payrollGroup?.keys.includes('driverPayRatePerKmSar'));
});

test('payroll API routes and pages exist', () => {
  const root = process.cwd();
  assert.ok(readFileSync(join(root, 'src/app/api/admin/payroll/runs/route.ts'), 'utf8').includes('generatePayrollRun'));
  assert.ok(readFileSync(join(root, 'src/app/api/driver/earnings/route.ts'), 'utf8').includes('loadGlobalPayRules'));
  assert.ok(readFileSync(join(root, 'src/app/admin/sections/PayrollSection.tsx'), 'utf8').includes('PayrollSection'));
  assert.ok(readFileSync(join(root, 'src/app/driver/earnings/page.tsx'), 'utf8').includes('DriverEarningsPage'));
});

test('prisma schema defines payroll models', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /model DriverPayProfile/);
  assert.match(schema, /model DriverTripEarning/);
  assert.match(schema, /model PayrollRun/);
  assert.match(schema, /model DriverPayrollLine/);
});
