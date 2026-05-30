import type { DriverState } from './roleRoutes.ts';
import { getDashboardPathForDriverState, getDashboardPathForRole } from './roleRoutes.ts';
import { isSafeReturnTo } from './driverAuthFlow.ts';

/**
 * Resolve post-login destination for family portal (/login).
 * Honors safe `from` param; otherwise routes by role/driverState.
 */
export function resolveFamilyLoginRedirect(
  role: string,
  driverState: DriverState | undefined,
  from: string | null | undefined,
): string {
  if (role === 'ADMIN') {
    if (isSafeReturnTo(from) && (from === '/admin' || from.startsWith('/admin'))) return from;
    return '/admin';
  }
  if (role === 'DRIVER') {
    if (isSafeReturnTo(from) && !from.startsWith('/admin')) return from;
    return getDashboardPathForRole('DRIVER');
  }
  if (driverState === 'DRIVER_APPLICANT') {
    return '/driver-application';
  }
  if (isSafeReturnTo(from) && !from.startsWith('/admin')) return from;
  return getDashboardPathForDriverState(driverState ?? 'PARENT');
}

/** Admin portal login — admins only. */
export function resolveAdminPortLoginRedirect(from: string | null | undefined): string {
  if (isSafeReturnTo(from) && from.startsWith('/admin')) return from;
  return '/admin';
}
