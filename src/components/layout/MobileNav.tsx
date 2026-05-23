'use client';

import { usePathname } from 'next/navigation';
import { useCurrentUser, type DriverState } from '@/hooks/useCurrentUser';

// ─── Inline SVG icon ──────────────────────────────────────────────────────────

function NavIcon({ paths, filled = false }: { paths: string; filled?: boolean }) {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={filled ? 2.25 : 1.75}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

// ─── Nav item types ───────────────────────────────────────────────────────────

type MobileNavItem = { label: string; href: string; icon: string };

const PARENT_ITEMS: MobileNavItem[] = [
  { label: 'Home',    href: '/dashboard',    icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { label: 'Riders',  href: '/riders',       icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { label: 'Trips',   href: '/trips',        icon: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4' },
  { label: 'Wallet',  href: '/wallet',       icon: 'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7' },
  { label: 'Profile', href: '/profile',      icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
];

// Restricted nav for pending driver applicants (PARENT role + pending application)
const APPLICANT_ITEMS: MobileNavItem[] = [
  { label: 'Application', href: '/driver-application', icon: 'M16 6l4 14 M12 6v14 M8 6l-4 14 M20 6H4' },
  { label: 'Alerts',      href: '/notifications',      icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0' },
  { label: 'Profile',     href: '/profile',            icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
];

const APPROVED_DRIVER_ITEMS: MobileNavItem[] = [
  { label: 'Dashboard', href: '/driver/dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { label: 'Trips',     href: '/trips',            icon: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4' },
  { label: 'GPS',       href: '/tracking',         icon: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { label: 'Alerts',    href: '/notifications',    icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0' },
  { label: 'Profile',   href: '/profile',          icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
];

const ADMIN_ITEMS: MobileNavItem[] = [
  { label: 'Admin',   href: '/admin',         icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
  { label: 'Alerts',  href: '/notifications', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0' },
  { label: 'Profile', href: '/profile',       icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
];

function getItemsForDriverState(state: DriverState): MobileNavItem[] {
  if (state === 'ADMIN')           return ADMIN_ITEMS;
  if (state === 'APPROVED_DRIVER') return APPROVED_DRIVER_ITEMS;
  if (state === 'APPLICANT')       return APPLICANT_ITEMS;
  return PARENT_ITEMS;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileNav() {
  const pathname = usePathname();
  // Shared hook — reuses the same /api/me request as Sidebar (module-level dedup)
  const { user } = useCurrentUser();

  const driverState: DriverState = user?.driverState ?? 'PARENT';
  const items = getItemsForDriverState(driverState);

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/driver/dashboard') return pathname === href;
    if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-fizza-secondary' : 'text-gray-400'
              }`}
            >
              <NavIcon paths={item.icon} filled={active} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
