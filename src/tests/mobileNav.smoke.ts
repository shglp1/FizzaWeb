/**
 * MobileNav role & cache smoke tests — run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMobileNavItemsForDriverState,
  shouldHideMobileNav,
  isPublicMobileNavRoute,
  MOBILE_NAV_SKELETON_SLOT_COUNT,
} from '../lib/mobileNav.ts';

describe('MobileNav loading state', () => {
  it('does not return Parent nav while loading', () => {
    assert.equal(getMobileNavItemsForDriverState(null, { loading: true }), null);
    assert.equal(getMobileNavItemsForDriverState(undefined, { loading: true }), null);
  });

  it('does not default unknown state to Parent nav', () => {
    assert.equal(getMobileNavItemsForDriverState(null), null);
    assert.equal(getMobileNavItemsForDriverState(undefined), null);
  });

  it('uses skeleton slot count of 5', () => {
    assert.equal(MOBILE_NAV_SKELETON_SLOT_COUNT, 5);
  });
});

describe('MobileNav driverState mapping', () => {
  it('PARENT gets family mobile nav with subscriptions and More menu', () => {
    const items = getMobileNavItemsForDriverState('PARENT');
    assert.ok(items);
    assert.ok(items!.some((i) => i.href === '/dashboard'));
    assert.ok(items!.some((i) => i.href === '/riders'));
    assert.ok(items!.some((i) => i.href === '/subscriptions'));
    assert.ok(items!.some((i) => i.href === '__more__'));
  });

  it('DRIVER_APPLICANT gets applicant nav only', () => {
    const items = getMobileNavItemsForDriverState('DRIVER_APPLICANT')!;
    assert.ok(items.some((i) => i.href === '/driver-application'));
    assert.ok(!items.some((i) => i.href === '/wallet'));
    assert.ok(!items.some((i) => i.href === '/riders'));
  });

  it('APPROVED_DRIVER gets driver nav with Earnings, not family Riders', () => {
    const items = getMobileNavItemsForDriverState('APPROVED_DRIVER')!;
    assert.ok(items.some((i) => i.href === '/driver/dashboard'));
    assert.ok(items.some((i) => i.href === '/driver/earnings'));
    assert.ok(!items.some((i) => i.href === '/riders'));
    assert.ok(!items.some((i) => i.href === '/wallet'));
  });

  it('ADMIN does not get Parent mobile nav', () => {
    const items = getMobileNavItemsForDriverState('ADMIN')!;
    assert.ok(!items.some((i) => i.href === '/dashboard' && i.label === 'Home'));
    assert.ok(!items.some((i) => i.href === '/riders'));
    assert.ok(items.some((i) => i.href === '/admin'));
  });
});

describe('MobileNav public and admin routes', () => {
  it('hides nav on public auth routes', () => {
    for (const path of ['/drive', '/login', '/register', '/driver/login', '/driver/register']) {
      assert.ok(shouldHideMobileNav(path), `expected hidden on ${path}`);
    }
  });

  it('hides nav on /admin', () => {
    assert.ok(shouldHideMobileNav('/admin'));
    assert.ok(shouldHideMobileNav('/admin?section=users'));
  });

  it('shows nav on protected family routes', () => {
    assert.equal(shouldHideMobileNav('/dashboard'), false);
    assert.equal(shouldHideMobileNav('/trips'), false);
  });

  it('isPublicMobileNavRoute matches /', () => {
    assert.ok(isPublicMobileNavRoute('/'));
    assert.ok(isPublicMobileNavRoute('/drive'));
  });
});

describe('useCurrentUser cache exports', () => {
  it('clearCurrentUserCache is exported', async () => {
    const mod = await import('../hooks/useCurrentUser.ts');
    assert.equal(typeof mod.clearCurrentUserCache, 'function');
    assert.equal(typeof mod.refetchCurrentUser, 'function');
  });
});
