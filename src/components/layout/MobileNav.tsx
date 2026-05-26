'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getMobileNavConfigForDriverState,
  shouldHideMobileNav,
  MOBILE_NAV_SKELETON_SLOT_COUNT,
  type MobileNavItem,
} from '@/lib/mobileNav';

const ICON_PATHS: Record<string, string> = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  riders: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  subscriptions: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  trips: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4',
  wallet: 'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  driverApp: 'M16 6l4 14 M12 6v14 M8 6l-4 14 M20 6H4',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  tracking: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  safety: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  more: 'M4 6h16 M4 12h16 M4 18h16',
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

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard' || href === '/driver/dashboard') return pathname === href;
  if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
  return pathname === href || pathname.startsWith(href + '/');
}

function MobileNavSkeleton({ slots = MOBILE_NAV_SKELETON_SLOT_COUNT }: { slots?: number }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden="true"
    >
      <div className="grid animate-pulse" style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
        {Array.from({ length: slots }).map((_, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-1.5 py-3 min-h-[60px]">
            <div className="h-5 w-5 rounded-md bg-gray-200" />
            <div className="h-2 w-10 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </nav>
  );
}

function MobileNavMoreSheet({
  open,
  onClose,
  items,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  pathname: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="More navigation">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close menu" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-2xl border-t border-gray-100"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-sm font-bold text-gray-900">Menu</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 min-h-[44px]"
          >
            Close
          </button>
        </div>
        <nav className="px-3 pb-3 space-y-1 max-h-[min(60vh,420px)] overflow-y-auto">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={[
                  'flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium transition-colors',
                  active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                <NavIcon iconKey={item.icon} filled={active} />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function MobileNavBar({
  bar,
  more,
  pathname,
}: {
  bar: MobileNavItem[];
  more: MobileNavItem[];
  pathname: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = more.some((item) => isNavActive(pathname, item.href));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bar.length}, 1fr)` }}>
          {bar.map((item) => {
            const isMore = item.href === '__more__';
            const active = isMore ? moreActive || moreOpen : isNavActive(pathname, item.href);

            if (isMore) {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  aria-expanded={moreOpen}
                  aria-haspopup="dialog"
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] text-[10px] font-semibold transition-colors ${
                    active ? 'text-fizza-secondary' : 'text-gray-400'
                  }`}
                >
                  <NavIcon iconKey={item.icon} filled={active} />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] text-[10px] font-semibold transition-colors ${
                  active ? 'text-fizza-secondary' : 'text-gray-400'
                }`}
              >
                <NavIcon iconKey={item.icon} filled={active} />
                <span className="truncate max-w-[4.5rem]">{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
      <MobileNavMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={more}
        pathname={pathname}
      />
    </>
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

  const config = getMobileNavConfigForDriverState(user.driverState);
  if (!config) {
    return <MobileNavSkeleton />;
  }

  return <MobileNavBar bar={config.bar} more={config.more} pathname={pathname} />;
}
