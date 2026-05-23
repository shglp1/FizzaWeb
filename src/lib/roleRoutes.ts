// ─── Role routing helpers ─────────────────────────────────────────────────────
// Client-safe display helpers only.
// All real authorization is enforced server-side via requireAuth/requireRole.

export type AppRole = 'ADMIN' | 'DRIVER' | 'PARENT';

/**
 * Computed UX state derived from JWT role + DB application status.
 * Returned by GET /api/me as `driverState`.
 *
 * - PARENT          → regular family user, no driver application
 * - APPLICANT       → PARENT role with a pending/rejected/needs-changes application
 *                     (or APPROVED application where JWT role hasn't been refreshed yet)
 * - APPROVED_DRIVER → JWT role is DRIVER (admin has approved + role was refreshed on login)
 * - ADMIN           → JWT role is ADMIN
 */
export type DriverState = 'PARENT' | 'APPLICANT' | 'APPROVED_DRIVER' | 'ADMIN';

/** Driver application status as returned by GET /api/driver-application */
export type DriverAppStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

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

/**
 * Returns true if the JWT role indicates an admin-approved operational driver.
 * role === 'DRIVER' is set by the backend only after an admin approves the application.
 */
export function isApprovedDriver(role: string): boolean {
  return role === 'DRIVER';
}

/**
 * Returns true if the user has a driver application that is not yet approved.
 * applicationStatus is the status field from GET /api/driver-application.
 */
export function isPendingDriverApplicant(applicationStatus: string | null | undefined): boolean {
  if (!applicationStatus) return false;
  return (
    applicationStatus === 'PENDING' ||
    applicationStatus === 'NEEDS_CHANGES' ||
    applicationStatus === 'REJECTED'
  );
}

/**
 * Given a driver application status, returns the appropriate driver portal path.
 * Approved → /driver/dashboard; all other states → /driver-application.
 */
export function getDriverPortalPath(applicationStatus: string | null | undefined): string {
  if (applicationStatus === 'APPROVED') return '/driver/dashboard';
  return '/driver-application';
}

// ─── Per-role allowed route prefixes (UX layer only) ─────────────────────────

const PARENT_PREFIXES = [
  '/dashboard', '/profile', '/riders', '/subscriptions',
  '/wallet', '/trips', '/tracking', '/safety', '/notifications',
  '/driver-application',
];

/** Restricted allow-list for pending driver applicants (PARENT role with a pending application). */
const DRIVER_APPLICANT_PREFIXES = [
  '/driver-application', '/profile', '/notifications',
];

const DRIVER_PREFIXES = [
  '/driver/dashboard', '/trips', '/profile', '/notifications',
  '/safety', '/tracking',
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

/**
 * Returns true if the pathname is accessible for a pending driver applicant.
 * More restrictive than the full PARENT allow-list.
 */
export function isRouteAllowedForApplicant(pathname: string): boolean {
  return DRIVER_APPLICANT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'),
  );
}

// ─── Navigation items per role ────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

// ── Parent nav ────────────────────────────────────────────────────────────────

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

// ── Driver applicant nav — restricted (PARENT role + pending application) ─────

export const DRIVER_APPLICANT_NAV: NavItem[] = [
  { label: 'My Application',   href: '/driver-application', icon: 'driverApp' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

export const DRIVER_APPLICANT_SECONDARY_NAV: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
];

// ── Approved driver nav ───────────────────────────────────────────────────────

export const DRIVER_NAV: NavItem[] = [
  { label: 'Driver Dashboard', href: '/driver/dashboard',   icon: 'dashboard' },
  { label: 'Assigned Trips',   href: '/trips',              icon: 'trips' },
  { label: 'GPS Tracking',     href: '/tracking',           icon: 'tracking' },
  { label: 'Safety',           href: '/safety',             icon: 'safety' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

export const DRIVER_SECONDARY_NAV: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
];

// ── Admin nav ─────────────────────────────────────────────────────────────────

export const ADMIN_NAV: NavItem[] = [
  { label: 'Admin Panel',      href: '/admin',              icon: 'admin' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

export const ADMIN_SECONDARY_NAV: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
];

// ─── Navigation selectors ─────────────────────────────────────────────────────

/**
 * Returns navigation for a given role.
 * For PARENT role, does NOT account for pending-applicant state —
 * callers must check `isPendingDriverApplicant` separately and use
 * `getNavigationForApplicant()` when appropriate.
 */
export function getNavigationForRole(role: string): { main: NavItem[]; secondary: NavItem[] } {
  if (role === 'ADMIN')  return { main: ADMIN_NAV,  secondary: ADMIN_SECONDARY_NAV };
  if (role === 'DRIVER') return { main: DRIVER_NAV, secondary: DRIVER_SECONDARY_NAV };
  return { main: PARENT_NAV, secondary: PARENT_SECONDARY_NAV };
}

/**
 * Returns the restricted navigation for a pending driver applicant.
 * Use when role === 'PARENT' AND isPendingDriverApplicant(status) === true.
 */
export function getNavigationForApplicant(): { main: NavItem[]; secondary: NavItem[] } {
  return { main: DRIVER_APPLICANT_NAV, secondary: DRIVER_APPLICANT_SECONDARY_NAV };
}

// ─── DriverState-based navigation (preferred — Task 10.3) ────────────────────
//
// These helpers consume `driverState` from GET /api/me and replace the old
// two-step pattern (role from /api/me + status from /api/driver-application).

/** Default dashboard path for each DriverState. */
const DRIVER_STATE_DASHBOARDS: Record<DriverState, string> = {
  PARENT:          '/dashboard',
  APPLICANT:       '/driver-application',
  APPROVED_DRIVER: '/driver/dashboard',
  ADMIN:           '/admin',
};

/** Returns the home/dashboard path for a given DriverState. */
export function getDashboardPathForDriverState(state: DriverState): string {
  return DRIVER_STATE_DASHBOARDS[state] ?? '/dashboard';
}

/**
 * Returns the correct navigation set for a given DriverState.
 * Replaces the old `getNavigationForRole` + `getNavigationForApplicant` split.
 * Called by Sidebar and MobileNav using the driverState from useCurrentUser().
 */
export function getNavigationForDriverState(
  state: DriverState,
): { main: NavItem[]; secondary: NavItem[] } {
  if (state === 'ADMIN')           return { main: ADMIN_NAV,            secondary: ADMIN_SECONDARY_NAV };
  if (state === 'APPROVED_DRIVER') return { main: DRIVER_NAV,           secondary: DRIVER_SECONDARY_NAV };
  if (state === 'APPLICANT')       return { main: DRIVER_APPLICANT_NAV, secondary: DRIVER_APPLICANT_SECONDARY_NAV };
  return { main: PARENT_NAV, secondary: PARENT_SECONDARY_NAV };
}
