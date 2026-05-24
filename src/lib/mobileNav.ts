import type { DriverState } from './roleRoutes';

export type MobileNavItem = { label: string; href: string; icon: string };

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

const PARENT_ITEMS: MobileNavItem[] = [
  { label: 'Home', href: '/dashboard', icon: 'home' },
  { label: 'Riders', href: '/riders', icon: 'riders' },
  { label: 'Trips', href: '/trips', icon: 'trips' },
  { label: 'Wallet', href: '/wallet', icon: 'wallet' },
  { label: 'Profile', href: '/profile', icon: 'profile' },
];

const APPLICANT_ITEMS: MobileNavItem[] = [
  { label: 'Application', href: '/driver-application', icon: 'driverApp' },
  { label: 'Alerts', href: '/notifications', icon: 'notifications' },
  { label: 'Profile', href: '/profile', icon: 'profile' },
];

const APPROVED_DRIVER_ITEMS: MobileNavItem[] = [
  { label: 'Dashboard', href: '/driver/dashboard', icon: 'home' },
  { label: 'Route', href: '/trips', icon: 'trips' },
  { label: 'Live GPS', href: '/tracking', icon: 'tracking' },
  { label: 'Safety', href: '/safety', icon: 'safety' },
  { label: 'Profile', href: '/profile', icon: 'profile' },
];

const ADMIN_ITEMS: MobileNavItem[] = [
  { label: 'Admin', href: '/admin', icon: 'admin' },
  { label: 'Alerts', href: '/notifications', icon: 'notifications' },
  { label: 'Profile', href: '/profile', icon: 'profile' },
];

/**
 * Returns mobile nav items for a known driverState.
 * Returns null while loading or when state is unknown — never defaults to PARENT.
 */
export function getMobileNavItemsForDriverState(
  driverState: DriverState | null | undefined,
  options?: { loading?: boolean },
): MobileNavItem[] | null {
  if (options?.loading || driverState == null) return null;
  if (driverState === 'ADMIN') return ADMIN_ITEMS;
  if (driverState === 'APPROVED_DRIVER') return APPROVED_DRIVER_ITEMS;
  if (driverState === 'DRIVER_APPLICANT') return APPLICANT_ITEMS;
  if (driverState === 'PARENT') return PARENT_ITEMS;
  return null;
}

export const MOBILE_NAV_SKELETON_SLOT_COUNT = 5;
