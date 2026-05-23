/**
 * Pure admin user classification logic.
 * Shared between GET /api/admin/users (runtime) and smoke tests (no DB).
 */

import type { AccountType } from './adminUserTypes';
import type { DriverState } from './roleRoutes';

export type RawApp = {
  id: string;
  status: string;
  adminResponse: string | null;
} | null;

/**
 * Compute the admin-facing account classification for a user.
 *
 * Mapping:
 * - ADMIN role               → accountType ADMIN
 * - DRIVER role              → accountType APPROVED_DRIVER
 * - PARENT + FAMILY + no app → accountType FAMILY_PARENT
 * - PARENT + DRIVER_PORTAL   → accountType DRIVER_APPLICANT (even without an application)
 * - PARENT + any app         → accountType DRIVER_APPLICANT (displayRole varies by app.status)
 */
export function classifyUser(
  role: string,
  registrationSource: string,
  app: RawApp,
): { accountType: AccountType; driverState: DriverState; displayRole: string } {
  if (role === 'ADMIN') {
    return { accountType: 'ADMIN', driverState: 'ADMIN', displayRole: 'Admin' };
  }
  if (role === 'DRIVER') {
    return { accountType: 'APPROVED_DRIVER', driverState: 'APPROVED_DRIVER', displayRole: 'Driver' };
  }
  // PARENT role — check registrationSource and application
  const isDriverApplicant = registrationSource === 'DRIVER_PORTAL' || app !== null;
  if (!isDriverApplicant) {
    return { accountType: 'FAMILY_PARENT', driverState: 'PARENT', displayRole: 'Parent' };
  }
  if (!app) {
    return {
      accountType: 'DRIVER_APPLICANT',
      driverState: 'DRIVER_APPLICANT',
      displayRole: 'Driver Applicant — Not Submitted',
    };
  }
  const STATUS_LABELS: Record<string, string> = {
    PENDING:       'Driver Applicant — Pending Review',
    NEEDS_CHANGES: 'Driver Applicant — Needs Changes',
    REJECTED:      'Driver Applicant — Rejected',
    APPROVED:      'Approved Application — Re-login/Role Sync Needed',
  };
  return {
    accountType: 'DRIVER_APPLICANT',
    driverState: 'DRIVER_APPLICANT',
    displayRole: STATUS_LABELS[app.status] ?? 'Driver Applicant',
  };
}
