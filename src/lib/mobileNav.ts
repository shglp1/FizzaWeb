import type { DriverState } from './roleRoutes';
import {
  getNavigationForDriverState,
  type NavItem,
} from './roleRoutes.ts';

export type MobileNavItem = { label: string; href: string; icon: string };

export type MobileNavConfig = {
  bar: MobileNavItem[];
  more: MobileNavItem[];
};

/** Routes where authenticated bottom nav must not appear. */
export const PUBLIC_MOBILE_NAV_ROUTES = [
  '/',
  '/drive',
  '/login',
  '/register',
  '/reset-password',
  '/verify',
  '/driver/login',
  '/driver/register',
] as const;

function pathOnly(pathname: string): string {
  return pathname.split('?')[0]?.split('#')[0] ?? pathname;
}

export function isPublicMobileNavRoute(pathname: string): boolean {
  const path = pathOnly(pathname);
  return PUBLIC_MOBILE_NAV_ROUTES.some(
    (p) => path === p || (p !== '/' && path.startsWith(p + '/')),
  );
}

export function isAdminMobileNavRoute(pathname: string): boolean {
  const path = pathOnly(pathname);
  return path === '/admin' || path.startsWith('/admin/');
}

export function shouldHideMobileNav(pathname: string): boolean {
  return isPublicMobileNavRoute(pathname) || isAdminMobileNavRoute(pathname);
}

function toMobileItem(item: NavItem): MobileNavItem {
  return { label: item.label, href: item.href, icon: item.icon };
}

const MORE_ITEM: MobileNavItem = { label: 'More', href: '__more__', icon: 'more' };

/** Primary bar hrefs — remaining sidebar items go in the More sheet. */
const PARENT_BAR_HREFS = ['/dashboard', '/riders', '/subscriptions', '/trips'] as const;
const DRIVER_BAR_HREFS = ['/driver/dashboard', '/trips', '/driver/earnings', '/tracking'] as const;

function configFromNav(main: NavItem[], secondary: NavItem[], barHrefs: readonly string[]): MobileNavConfig {
  const barSet = new Set<string>(barHrefs);
  const all = [...main, ...secondary];
  const bar = all.filter((i) => barSet.has(i.href)).map(toMobileItem);
  const more = all.filter((i) => !barSet.has(i.href)).map(toMobileItem);
  return {
    bar: more.length > 0 ? [...bar, MORE_ITEM] : bar,
    more,
  };
}

/**
 * Full mobile nav config: bottom bar + overflow items (matches desktop sidebar).
 */
export function getMobileNavConfigForDriverState(
  driverState: DriverState | null | undefined,
  options?: { loading?: boolean },
): MobileNavConfig | null {
  if (options?.loading || driverState == null) return null;

  if (driverState === 'ADMIN') {
    const { main, secondary } = getNavigationForDriverState('ADMIN');
    const all = [...main, ...secondary].map(toMobileItem);
    return all.length <= 5
      ? { bar: all, more: [] }
      : { bar: [...all.slice(0, 4), MORE_ITEM], more: all.slice(4) };
  }

  if (driverState === 'APPROVED_DRIVER') {
    const { main, secondary } = getNavigationForDriverState('APPROVED_DRIVER');
    return configFromNav(main, secondary, DRIVER_BAR_HREFS);
  }

  if (driverState === 'DRIVER_APPLICANT') {
    const { main, secondary } = getNavigationForDriverState('DRIVER_APPLICANT');
    const all = [...main, ...secondary].map(toMobileItem);
    return { bar: all, more: [] };
  }

  if (driverState === 'PARENT') {
    const { main, secondary } = getNavigationForDriverState('PARENT');
    return configFromNav(main, secondary, PARENT_BAR_HREFS);
  }

  return null;
}

/**
 * Returns bottom-bar items only (includes More when overflow exists).
 */
export function getMobileNavItemsForDriverState(
  driverState: DriverState | null | undefined,
  options?: { loading?: boolean },
): MobileNavItem[] | null {
  const config = getMobileNavConfigForDriverState(driverState, options);
  return config?.bar ?? null;
}

export function getMobileNavMoreItemsForDriverState(
  driverState: DriverState | null | undefined,
  options?: { loading?: boolean },
): MobileNavItem[] | null {
  const config = getMobileNavConfigForDriverState(driverState, options);
  if (!config) return null;
  return config.more;
}

export const MOBILE_NAV_SKELETON_SLOT_COUNT = 5;
