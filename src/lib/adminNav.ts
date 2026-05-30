/** Admin dashboard sections — single nav source for AdminShell and tests. */

export type AdminSection =
  | 'overview'
  | 'users'
  | 'riders'
  | 'drivers'
  | 'applications'
  | 'packages'
  | 'promo-codes'
  | 'map-places'
  | 'subscriptions'
  | 'trips'
  | 'live-ops'
  | 'financial-review'
  | 'financials'
  | 'payroll'
  | 'safety'
  | 'sysconfig'
  | 'audit';

export type AdminNavItem = {
  label: string;
  section: AdminSection;
  icon: string;
};

export const ADMIN_SECTIONS: AdminNavItem[] = [
  { label: 'Overview',            section: 'overview',      icon: 'dashboard' },
  { label: 'Users',               section: 'users',         icon: 'profile' },
  { label: 'Riders',              section: 'riders',        icon: 'riders' },
  { label: 'Drivers',             section: 'drivers',       icon: 'trips' },
  { label: 'Driver Applications', section: 'applications',  icon: 'driverApp' },
  { label: 'Packages & Add-ons',  section: 'packages',      icon: 'subscriptions' },
  { label: 'Promo Codes',         section: 'promo-codes',   icon: 'ticket' },
  { label: 'Map Places',          section: 'map-places',    icon: 'mapPin' },
  { label: 'Subscriptions',       section: 'subscriptions', icon: 'subscriptions' },
  { label: 'Trips',               section: 'trips',         icon: 'trips' },
  { label: 'Live Operations',     section: 'live-ops',      icon: 'tracking' },
  { label: 'Financial Review',    section: 'financial-review', icon: 'financialReview' },
  { label: 'Financials',          section: 'financials',    icon: 'wallet' },
  { label: 'Driver Payroll',      section: 'payroll',       icon: 'payroll' },
  { label: 'Safety Reports',      section: 'safety',        icon: 'safety' },
  { label: 'System Config',       section: 'sysconfig',     icon: 'admin' },
  { label: 'Audit Logs',          section: 'audit',         icon: 'auditLog' },
];

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  overview: 'Overview',
  users: 'Users',
  riders: 'Riders',
  drivers: 'Drivers',
  applications: 'Driver Applications',
  packages: 'Packages & Add-ons',
  'promo-codes': 'Promo Codes',
  'map-places': 'Map Places',
  subscriptions: 'Subscriptions',
  trips: 'Trips',
  'live-ops': 'Live Operations',
  'financial-review': 'Financial Review',
  financials: 'Financials',
  payroll: 'Driver Payroll',
  safety: 'Safety Reports',
  sysconfig: 'System Config',
  audit: 'Audit Logs',
};

export function adminSectionHref(section: AdminSection): string {
  return `/admin?section=${section}`;
}

export function parseAdminSection(value: string | null): AdminSection {
  const valid = ADMIN_SECTIONS.map((s) => s.section);
  if (value && valid.includes(value as AdminSection)) {
    return value as AdminSection;
  }
  return 'overview';
}

/** Parent nav hrefs that must not appear on /admin. */
export const PARENT_ONLY_NAV_HREFS = [
  '/dashboard',
  '/riders',
  '/subscriptions',
  '/wallet',
  '/driver-application',
];
