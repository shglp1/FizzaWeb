'use client';

import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getMobileNavItemsForDriverState,
  shouldHideMobileNav,
  MOBILE_NAV_SKELETON_SLOT_COUNT,
  type MobileNavItem,
} from '@/lib/mobileNav';

const ICON_PATHS: Record<string, string> = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  riders: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  trips: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4',
  wallet: 'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  driverApp: 'M16 6l4 14 M12 6v14 M8 6l-4 14 M20 6H4',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  tracking: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  safety: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

function NavIcon({ iconKey, filled = false }: { iconKey: string; filled?: boolean }) {
  const paths = ICON_PATHS[iconKey] ?? ICON_PATHS.home;
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={filled ? 2.25 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

function MobileNavSkeleton({ slots = MOBILE_NAV_SKELETON_SLOT_COUNT }: { slots?: number }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden="true"
    >
      <div
        className="grid animate-pulse"
        style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}
      >
        {Array.from({ length: slots }).map((_, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-1 py-2.5">
            <div className="h-5 w-5 rounded-md bg-gray-200" />
            <div className="h-2 w-8 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </nav>
  );
}

function MobileNavBar({
  items,
  pathname,
}: {
  items: MobileNavItem[];
  pathname: string;
}) {
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
              <NavIcon iconKey={item.icon} filled={active} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { user, loading, isUnauthorized } = useCurrentUser();

  if (shouldHideMobileNav(pathname)) {
    return null;
  }

  if (loading) {
    return <MobileNavSkeleton />;
  }

  if (isUnauthorized || !user) {
    return null;
  }

  const items = getMobileNavItemsForDriverState(user.driverState);
  if (!items) {
    return <MobileNavSkeleton />;
  }

  return <MobileNavBar items={items} pathname={pathname} />;
}
