/**
 * Shared types for admin user classification.
 * Used by both the API route and the client-side UsersSection component.
 */

/** Computed account classification returned by GET /api/admin/users. */
export type AccountType =
  | 'FAMILY_PARENT'    // role=PARENT, registrationSource=FAMILY, no application
  | 'DRIVER_APPLICANT' // role=PARENT, from DRIVER_PORTAL or has a driverApplication
  | 'APPROVED_DRIVER'  // role=DRIVER
  | 'ADMIN';           // role=ADMIN
