/**
 * Role routing smoke tests — run with: npm test
 * Uses Node.js built-in test runner. No database or Next.js required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getDashboardPathForRole,
  isRouteAllowedForRole,
  getNavigationForRole,
} from '../lib/roleRoutes.ts';

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
  it('unknown role → /dashboard (safe default)', () => {
    assert.equal(getDashboardPathForRole('UNKNOWN'), '/dashboard');
  });
});

describe('isRouteAllowedForRole', () => {
  it('ADMIN can access /admin', () => {
    assert.ok(isRouteAllowedForRole('/admin', 'ADMIN'));
  });
  it('ADMIN is redirected from /dashboard (not in allowed list)', () => {
    // Middleware sends ADMIN→/admin; this helper reflects the same
    assert.ok(!isRouteAllowedForRole('/dashboard', 'ADMIN'));
  });
  it('ADMIN is redirected from /driver/dashboard (not in allowed list)', () => {
    assert.ok(!isRouteAllowedForRole('/driver/dashboard', 'ADMIN'));
  });

  it('DRIVER can access /driver/dashboard', () => {
    assert.ok(isRouteAllowedForRole('/driver/dashboard', 'DRIVER'));
  });
  it('DRIVER can access /trips', () => {
    assert.ok(isRouteAllowedForRole('/trips', 'DRIVER'));
  });
  it('DRIVER cannot access /admin', () => {
    assert.ok(!isRouteAllowedForRole('/admin', 'DRIVER'));
  });
  it('DRIVER cannot access /dashboard', () => {
    assert.ok(!isRouteAllowedForRole('/dashboard', 'DRIVER'));
  });

  it('PARENT can access /dashboard', () => {
    assert.ok(isRouteAllowedForRole('/dashboard', 'PARENT'));
  });
  it('PARENT can access /trips', () => {
    assert.ok(isRouteAllowedForRole('/trips', 'PARENT'));
  });
  it('PARENT cannot access /admin', () => {
    assert.ok(!isRouteAllowedForRole('/admin', 'PARENT'));
  });
  it('PARENT cannot access /driver/dashboard', () => {
    assert.ok(!isRouteAllowedForRole('/driver/dashboard', 'PARENT'));
  });
});

describe('getNavigationForRole', () => {
  it('PARENT nav includes /dashboard', () => {
    const { main } = getNavigationForRole('PARENT');
    assert.ok(main.some((i) => i.href === '/dashboard'), 'missing /dashboard');
  });
  it('PARENT nav does not include /admin', () => {
    const { main, secondary } = getNavigationForRole('PARENT');
    const all = [...main, ...secondary];
    assert.ok(!all.some((i) => i.href === '/admin'), 'should not have /admin');
  });
  it('PARENT nav does not include /driver/dashboard', () => {
    const { main, secondary } = getNavigationForRole('PARENT');
    const all = [...main, ...secondary];
    assert.ok(!all.some((i) => i.href === '/driver/dashboard'));
  });

  it('DRIVER nav includes /driver/dashboard', () => {
    const { main } = getNavigationForRole('DRIVER');
    assert.ok(main.some((i) => i.href === '/driver/dashboard'));
  });
  it('DRIVER nav does not include /dashboard', () => {
    const { main, secondary } = getNavigationForRole('DRIVER');
    const all = [...main, ...secondary];
    assert.ok(!all.some((i) => i.href === '/dashboard'));
  });
  it('DRIVER nav does not include /admin', () => {
    const { main, secondary } = getNavigationForRole('DRIVER');
    const all = [...main, ...secondary];
    assert.ok(!all.some((i) => i.href === '/admin'));
  });

  it('ADMIN nav includes /admin', () => {
    const { main } = getNavigationForRole('ADMIN');
    assert.ok(main.some((i) => i.href === '/admin'));
  });
});

describe('Admin financial endpoint role enforcement', () => {
  it('/api/admin/wallet-adjustments enforces ADMIN role via requireRole', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/wallet-adjustments/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("requireRole(['ADMIN'])"),
      '/api/admin/wallet-adjustments must call requireRole([ADMIN])',
    );
  });

  it('/api/admin/wallet-transactions enforces ADMIN role via requireRole', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/wallet-transactions/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("requireRole(['ADMIN'])"),
      '/api/admin/wallet-transactions must call requireRole([ADMIN])',
    );
  });

  it('/api/admin/trips/[id]/financial-review enforces ADMIN role', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/trips/[id]/financial-review/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("requireRole(['ADMIN'])"),
      'financial-review route must call requireRole([ADMIN])',
    );
  });

  it('/api/admin/trips/[id]/financial-review/credit-preview enforces ADMIN role', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/trips/[id]/financial-review/credit-preview/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("requireRole(['ADMIN'])"),
      'credit-preview route must call requireRole([ADMIN])',
    );
  });
});

describe('Wallet balance safety (inline helper)', () => {
  function safeBalance(balanceSar: number | undefined | null): string {
    const n = balanceSar ?? 0;
    return `SAR ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
  }

  it('formats a normal balance', () => {
    assert.equal(safeBalance(12.5), 'SAR 12.50');
  });
  it('formats zero', () => {
    assert.equal(safeBalance(0), 'SAR 0.00');
  });
  it('handles undefined → SAR 0.00', () => {
    assert.equal(safeBalance(undefined), 'SAR 0.00');
  });
  it('handles null → SAR 0.00', () => {
    assert.equal(safeBalance(null), 'SAR 0.00');
  });
  it('handles NaN → SAR 0.00', () => {
    assert.equal(safeBalance(NaN), 'SAR 0.00');
  });
  it('handles Infinity → SAR 0.00', () => {
    assert.equal(safeBalance(Infinity), 'SAR 0.00');
  });
  it('formats negative balance', () => {
    assert.equal(safeBalance(-5.99), 'SAR -5.99');
  });
});
