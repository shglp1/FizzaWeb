import type { DriverState } from './roleRoutes';

/** Internal path only — blocks open redirects. */
export function isSafeReturnTo(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  return true;
}

export const DRIVER_APPLICATION_LOGIN_PATH =
  '/driver/login?returnTo=/driver-application';

export function resolveDriverLoginRedirect(
  returnTo: string | null | undefined,
  driverState: DriverState,
): string {
  if (isSafeReturnTo(returnTo)) return returnTo;
  if (driverState === 'ADMIN') return '/admin';
  if (driverState === 'APPROVED_DRIVER') return '/driver/dashboard';
  if (driverState === 'DRIVER_APPLICANT') return '/driver-application';
  return '/driver-application';
}

/** True when the driver application form may be shown (authenticated applicant). */
export function canAccessDriverApplicationForm(
  authenticated: boolean,
  driverState: DriverState | undefined,
): boolean {
  return authenticated && driverState === 'DRIVER_APPLICANT';
}

/** True when unauthenticated users must not see the form. */
export function requiresDriverSignIn(
  userLoading: boolean,
  authenticated: boolean,
): boolean {
  return !userLoading && !authenticated;
}
