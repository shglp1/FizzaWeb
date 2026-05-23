'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Logo } from './Logo';
import { useCurrentUser, type DriverState } from '@/hooks/useCurrentUser';
import { getNavigationForDriverState, type NavItem } from '@/lib/roleRoutes';

// ─── Icon paths ───────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  dashboard:    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  riders:       'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  subscriptions:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  trips:        'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4',
  wallet:       'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  safety:       'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  notifications:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  profile:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  tracking:     'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  admin:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  driverApp:    'M16 6l4 14 M12 6v14 M8 6l-4 14 M20 6H4',
  logout:       'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
};

// ─── Single nav link ──────────────────────────────────────────────────────────

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const iconPath = ICONS[item.icon] ?? '';
  return (
    <a
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-white/15 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className={`shrink-0 transition-colors ${active ? 'text-fizza-soft' : 'text-white/50 group-hover:text-white/80'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {iconPath.split(' M').map((seg, i) => (
            <path key={i} d={i === 0 ? seg : 'M' + seg} />
          ))}
        </svg>
      </span>
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-fizza-soft shrink-0" />}
    </a>
  );
}

// ─── Role chip config — keyed by DriverState ──────────────────────────────────

const ROLE_CHIP: Record<DriverState, { label: string; cls: string }> = {
  ADMIN:            { label: 'Admin',     cls: 'bg-red-500/20 text-red-200' },
  APPROVED_DRIVER:  { label: 'Driver',    cls: 'bg-blue-500/20 text-blue-200' },
  DRIVER_APPLICANT: { label: 'Applicant', cls: 'bg-amber-500/20 text-amber-200' },
  PARENT:           { label: 'Parent',    cls: 'bg-white/10 text-white/60' },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function NavSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 py-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-white/10" />
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname     = usePathname();
  const router       = useRouter();
  const { user, loading } = useCurrentUser();
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/dashboard' || href === '/driver/dashboard') return pathname === href;
      if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
      return pathname === href || pathname.startsWith(href + '/');
    },
    [pathname],
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const resolvedState: DriverState = user?.driverState ?? 'PARENT';
  const { main, secondary } = loading && !user
    ? { main: [] as NavItem[], secondary: [] as NavItem[] }
    : getNavigationForDriverState(resolvedState);
  const chip = ROLE_CHIP[resolvedState];

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return null;
  }

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-fizza-primary shrink-0">
      {/* Logo + role chip */}
      <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-white/10">
        <Logo theme="dark" />
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${chip.cls}`}>
          {chip.label}
        </span>
      </div>

      {/* Nav — skeleton while /api/me loads */}
      {loading ? (
        <NavSkeleton />
      ) : (
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
          {main.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}

          {secondary.length > 0 && (
            <>
              <div className="my-3 border-t border-white/10" />
              {secondary.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </>
          )}

          {/* Driver portal link for applicants */}
          {resolvedState === 'DRIVER_APPLICANT' && (
            <>
              <div className="my-3 border-t border-white/10" />
              <a
                href="/drive"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Driver Portal
              </a>
            </>
          )}
        </nav>
      )}

      {/* Logout */}
      <div className="px-3 pb-4 pt-2 border-t border-white/10">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
            {ICONS['logout']!.split(' M').map((seg, i) => (
              <path key={i} d={i === 0 ? seg : 'M' + seg} />
            ))}
          </svg>
          <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>
        </button>
      </div>
    </aside>
  );
}
