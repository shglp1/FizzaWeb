/**
 * Packages & Add-ons admin smoke tests — run with: npm test
 * No database or network required. Tests pure schema/logic only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// ─── Inline the schemas we want to test (mirrors the actual API schemas) ──────

const createPackageSchema = z.object({
  name: z.string().min(1).max(100),
  billingCycle: z.string().min(1).max(50),
  priceSar: z.number().positive(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

const updatePackageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  billingCycle: z.string().min(1).max(50).optional(),
  priceSar: z.number().positive().optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});

const createAddOnSchema = z.object({
  name: z.string().min(1).max(100),
  priceSar: z.number().positive(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateAddOnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priceSar: z.number().positive().optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── createPackageSchema ──────────────────────────────────────────────────────

describe('createPackageSchema', () => {
  it('accepts minimal valid package', () => {
    const r = createPackageSchema.safeParse({ name: 'Monthly', billingCycle: 'monthly', priceSar: 299 });
    assert.ok(r.success);
    assert.equal(r.data?.isActive, true); // default
  });

  it('accepts package with all fields', () => {
    const r = createPackageSchema.safeParse({
      name: 'Premium',
      billingCycle: 'monthly',
      priceSar: 499.99,
      description: 'Premium plan with GPS tracking',
      sortOrder: 1,
      isActive: false,
    });
    assert.ok(r.success);
    assert.equal(r.data?.sortOrder, 1);
    assert.equal(r.data?.isActive, false);
  });

  it('rejects missing name', () => {
    const r = createPackageSchema.safeParse({ billingCycle: 'monthly', priceSar: 299 });
    assert.ok(!r.success);
  });

  it('rejects empty name', () => {
    const r = createPackageSchema.safeParse({ name: '', billingCycle: 'monthly', priceSar: 299 });
    assert.ok(!r.success);
  });

  it('rejects missing billingCycle', () => {
    const r = createPackageSchema.safeParse({ name: 'Monthly', priceSar: 299 });
    assert.ok(!r.success);
  });

  it('rejects zero price', () => {
    const r = createPackageSchema.safeParse({ name: 'Monthly', billingCycle: 'monthly', priceSar: 0 });
    assert.ok(!r.success);
  });

  it('rejects negative price', () => {
    const r = createPackageSchema.safeParse({ name: 'Monthly', billingCycle: 'monthly', priceSar: -1 });
    assert.ok(!r.success);
  });

  it('rejects non-integer sortOrder', () => {
    const r = createPackageSchema.safeParse({
      name: 'Monthly',
      billingCycle: 'monthly',
      priceSar: 299,
      sortOrder: 1.5,
    });
    assert.ok(!r.success);
  });

  it('accepts sortOrder of 0', () => {
    const r = createPackageSchema.safeParse({
      name: 'Monthly',
      billingCycle: 'monthly',
      priceSar: 299,
      sortOrder: 0,
    });
    assert.ok(r.success);
    assert.equal(r.data?.sortOrder, 0);
  });
});

// ─── updatePackageSchema ──────────────────────────────────────────────────────

describe('updatePackageSchema', () => {
  it('accepts empty object (all optional)', () => {
    const r = updatePackageSchema.safeParse({});
    assert.ok(r.success);
  });

  it('accepts partial update', () => {
    const r = updatePackageSchema.safeParse({ priceSar: 399 });
    assert.ok(r.success);
    assert.equal(r.data?.priceSar, 399);
  });

  it('accepts null description (clear it)', () => {
    const r = updatePackageSchema.safeParse({ description: null });
    assert.ok(r.success);
  });

  it('accepts null sortOrder (clear it)', () => {
    const r = updatePackageSchema.safeParse({ sortOrder: null });
    assert.ok(r.success);
  });

  it('rejects zero price on update', () => {
    const r = updatePackageSchema.safeParse({ priceSar: 0 });
    assert.ok(!r.success);
  });

  it('rejects empty name on update', () => {
    const r = updatePackageSchema.safeParse({ name: '' });
    assert.ok(!r.success);
  });
});

// ─── createAddOnSchema ────────────────────────────────────────────────────────

describe('createAddOnSchema', () => {
  it('accepts minimal valid add-on', () => {
    const r = createAddOnSchema.safeParse({ name: 'GPS', priceSar: 29 });
    assert.ok(r.success);
    assert.equal(r.data?.isActive, true);
  });

  it('accepts add-on with all fields', () => {
    const r = createAddOnSchema.safeParse({
      name: 'GPS Tracking',
      priceSar: 49.99,
      description: 'Real-time GPS tracking',
      sortOrder: 2,
      isActive: true,
    });
    assert.ok(r.success);
  });

  it('rejects missing name', () => {
    const r = createAddOnSchema.safeParse({ priceSar: 29 });
    assert.ok(!r.success);
  });

  it('rejects missing priceSar', () => {
    const r = createAddOnSchema.safeParse({ name: 'GPS' });
    assert.ok(!r.success);
  });

  it('rejects negative price', () => {
    const r = createAddOnSchema.safeParse({ name: 'GPS', priceSar: -5 });
    assert.ok(!r.success);
  });

  it('rejects non-integer sortOrder', () => {
    const r = createAddOnSchema.safeParse({ name: 'GPS', priceSar: 29, sortOrder: 2.7 });
    assert.ok(!r.success);
  });
});

// ─── updateAddOnSchema ────────────────────────────────────────────────────────

describe('updateAddOnSchema', () => {
  it('accepts empty object', () => {
    const r = updateAddOnSchema.safeParse({});
    assert.ok(r.success);
  });

  it('accepts partial price update', () => {
    const r = updateAddOnSchema.safeParse({ priceSar: 39 });
    assert.ok(r.success);
  });

  it('accepts null description', () => {
    const r = updateAddOnSchema.safeParse({ description: null });
    assert.ok(r.success);
  });

  it('rejects empty name', () => {
    const r = updateAddOnSchema.safeParse({ name: '' });
    assert.ok(!r.success);
  });
});

// ─── Soft-delete logic ────────────────────────────────────────────────────────

describe('soft-delete logic (in-use packages/add-ons)', () => {
  const shouldSoftDelete = (subscriptionCount: number): boolean => subscriptionCount > 0;

  it('soft-deletes when subscriptions exist', () => {
    assert.ok(shouldSoftDelete(3));
    assert.ok(shouldSoftDelete(1));
  });

  it('hard-deletes when no subscriptions', () => {
    assert.ok(!shouldSoftDelete(0));
  });
});

// ─── Payment snapshot logic ───────────────────────────────────────────────────

describe('payment amount uses finalPriceSar snapshot', () => {
  interface MockSubscription {
    finalPriceSar: number;
    package: { priceSar: number } | null;
    addOns: { addOn: { priceSar: number } }[];
  }

  // Simulates the correct (fixed) logic
  const getPaymentAmount = (sub: MockSubscription): number => Number(sub.finalPriceSar);

  // Simulates the old (buggy) logic
  const getBuggyPaymentAmount = (sub: MockSubscription): number => {
    const packagePrice = Number(sub.package?.priceSar ?? 0);
    const addOnTotal = sub.addOns.reduce((sum, a) => sum + Number(a.addOn.priceSar), 0);
    return packagePrice + addOnTotal;
  };

  it('snapshot amount is used regardless of current package price', () => {
    const sub: MockSubscription = {
      finalPriceSar: 500, // price at subscription time
      package: { priceSar: 400 }, // current price (changed)
      addOns: [],
    };
    assert.equal(getPaymentAmount(sub), 500);
  });

  it('buggy calculation uses wrong current price', () => {
    const sub: MockSubscription = {
      finalPriceSar: 500,
      package: { priceSar: 400 }, // current price differs
      addOns: [],
    };
    assert.equal(getBuggyPaymentAmount(sub), 400); // incorrect
    assert.notEqual(getBuggyPaymentAmount(sub), 500);
  });

  it('snapshot includes add-on changes correctly', () => {
    const sub: MockSubscription = {
      finalPriceSar: 600, // original total with add-ons
      package: { priceSar: 500 },
      addOns: [{ addOn: { priceSar: 30 } }], // current add-on price
    };
    assert.equal(getPaymentAmount(sub), 600);
    // Buggy: 500 + 30 = 530 (wrong — add-on price may have changed too)
    assert.equal(getBuggyPaymentAmount(sub), 530);
  });
});

// ─── sortOrder ordering logic ─────────────────────────────────────────────────

describe('sortOrder + priceSar ordering', () => {
  interface Item { name: string; sortOrder: number | null; priceSar: number }

  const sortItems = (items: Item[]): Item[] =>
    [...items].sort((a, b) => {
      const aOrder = a.sortOrder ?? Infinity;
      const bOrder = b.sortOrder ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.priceSar - b.priceSar;
    });

  it('items with sortOrder come before those without', () => {
    const items: Item[] = [
      { name: 'C', sortOrder: null, priceSar: 100 },
      { name: 'A', sortOrder: 1, priceSar: 300 },
    ];
    const sorted = sortItems(items);
    assert.equal(sorted[0]?.name, 'A');
    assert.equal(sorted[1]?.name, 'C');
  });

  it('lower sortOrder comes first', () => {
    const items: Item[] = [
      { name: 'B', sortOrder: 2, priceSar: 100 },
      { name: 'A', sortOrder: 1, priceSar: 200 },
    ];
    const sorted = sortItems(items);
    assert.equal(sorted[0]?.name, 'A');
  });

  it('equal sortOrder: lower price comes first', () => {
    const items: Item[] = [
      { name: 'B', sortOrder: 1, priceSar: 300 },
      { name: 'A', sortOrder: 1, priceSar: 200 },
    ];
    const sorted = sortItems(items);
    assert.equal(sorted[0]?.name, 'A');
  });

  it('null sortOrder items ordered by price among themselves', () => {
    const items: Item[] = [
      { name: 'B', sortOrder: null, priceSar: 300 },
      { name: 'A', sortOrder: null, priceSar: 100 },
    ];
    const sorted = sortItems(items);
    assert.equal(sorted[0]?.name, 'A');
  });
});

// ─── Admin subscription creation: rider ownership ─────────────────────────────

describe('admin subscription creation: rider ownership check', () => {
  const checkRiderOwnership = (
    requestedIds: string[],
    foundIds: string[],
  ): boolean => foundIds.length === requestedIds.length;

  it('passes when all riders belong to target user', () => {
    assert.ok(checkRiderOwnership(['a', 'b'], ['a', 'b']));
  });

  it('fails when some riders do not belong to target user', () => {
    assert.ok(!checkRiderOwnership(['a', 'b', 'c'], ['a', 'b']));
  });

  it('fails when no riders found', () => {
    assert.ok(!checkRiderOwnership(['a'], []));
  });

  it('passes with single rider', () => {
    assert.ok(checkRiderOwnership(['a'], ['a']));
  });
});

// ─── AuditLog action naming ───────────────────────────────────────────────────

describe('audit log actions for package/add-on management', () => {
  const VALID_ACTIONS = new Set([
    'ADMIN_PACKAGE_CREATED',
    'ADMIN_PACKAGE_UPDATED',
    'ADMIN_PACKAGE_DEACTIVATED',
    'ADMIN_PACKAGE_DELETED',
    'ADMIN_ADDON_CREATED',
    'ADMIN_ADDON_UPDATED',
    'ADMIN_ADDON_DEACTIVATED',
    'ADMIN_ADDON_DELETED',
    'ADMIN_SUBSCRIPTION_CREATED',
  ]);

  it('all expected actions are defined', () => {
    for (const action of VALID_ACTIONS) {
      assert.ok(typeof action === 'string' && action.length > 0, `Action ${action} should be a non-empty string`);
    }
  });

  it('package actions follow naming convention', () => {
    const packageActions = [...VALID_ACTIONS].filter((a) => a.startsWith('ADMIN_PACKAGE'));
    assert.equal(packageActions.length, 4);
  });

  it('addon actions follow naming convention', () => {
    const addonActions = [...VALID_ACTIONS].filter((a) => a.startsWith('ADMIN_ADDON'));
    assert.equal(addonActions.length, 4);
  });
});
