// ─── Role routing helpers ─────────────────────────────────────────────────────
// Client-safe display helpers only.
// All real authorization is enforced server-side via requireAuth/requireRole.

export type AppRole = 'ADMIN' | 'DRIVER' | 'PARENT';

/** Default dashboard path for each role. */
export const ROLE_DASHBOARDS: Record<AppRole, string> = {
  ADMIN:  '/admin',
  DRIVER: '/driver/dashboard',
  PARENT: '/dashboard',
};

/** Returns the home/dashboard path for a given role string. */
export function getDashboardPathForRole(role: string): string {
  return ROLE_DASHBOARDS[role as AppRole] ?? '/dashboard';
}

// ─── Per-role allowed route prefixes (UX layer only) ─────────────────────────

const PARENT_PREFIXES = [
  '/dashboard', '/profile', '/riders', '/subscriptions',
  '/wallet', '/trips', '/tracking', '/safety', '/notifications',
  '/driver-application',
];

const DRIVER_PREFIXES = [
  '/driver/dashboard', '/trips', '/profile', '/notifications',
  '/safety', '/tracking', '/driver-application',
];

const ADMIN_PREFIXES = ['/admin', '/profile', '/notifications'];

/**
 * Returns true if the pathname is accessible for the given role (UX display only).
 * NOT a security boundary — middleware.ts enforces the real server-side check.
 */
export function isRouteAllowedForRole(pathname: string, role: string): boolean {
  const map: Record<string, string[]> = {
    ADMIN:  ADMIN_PREFIXES,
    DRIVER: DRIVER_PREFIXES,
    PARENT: PARENT_PREFIXES,
  };
  const allowed = map[role] ?? PARENT_PREFIXES;
  return allowed.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'),
  );
}

// ─── Navigation items per role ────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const PARENT_NAV: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',          icon: 'dashboard' },
  { label: 'Riders',           href: '/riders',             icon: 'riders' },
  { label: 'Subscriptions',    href: '/subscriptions',      icon: 'subscriptions' },
  { label: 'Trips',            href: '/trips',              icon: 'trips' },
  { label: 'Wallet',           href: '/wallet',             icon: 'wallet' },
  { label: 'Safety',           href: '/safety',             icon: 'safety' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

export const PARENT_SECONDARY_NAV: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
  { label: 'Drive with Fizza', href: '/driver-application', icon: 'driverApp' },
];

export const DRIVER_NAV: NavItem[] = [
  { label: 'Driver Dashboard', href: '/driver/dashboard',   icon: 'dashboard' },
  { label: 'Assigned Trips',   href: '/trips',              icon: 'trips' },
  { label: 'GPS Tracking',     href: '/tracking',           icon: 'tracking' },
  { label: 'Safety',           href: '/safety',             icon: 'safety' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

export const DRIVER_SECONDARY_NAV: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
  { label: 'Application',      href: '/driver-application', icon: 'driverApp' },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Admin Panel',      href: '/admin',              icon: 'admin' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

export const ADMIN_SECONDARY_NAV: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
];

export function getNavigationForRole(role: string): { main: NavItem[]; secondary: NavItem[] } {
  if (role === 'ADMIN')  return { main: ADMIN_NAV,  secondary: ADMIN_SECONDARY_NAV };
  if (role === 'DRIVER') return { main: DRIVER_NAV, secondary: DRIVER_SECONDARY_NAV };
  return { main: PARENT_NAV, secondary: PARENT_SECONDARY_NAV };
}
