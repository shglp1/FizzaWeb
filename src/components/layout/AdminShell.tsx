'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from './Logo';
import {
  ADMIN_SECTIONS,
  adminSectionHref,
  parseAdminSection,
  type AdminSection,
} from '@/lib/adminNav';

// Reuse sidebar icon paths from Sidebar
const ICONS: Record<string, string> = {
  dashboard:    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  riders:       'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  subscriptions:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  trips:        'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4',
  wallet:       'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  safety:       'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  profile:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  admin:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  driverApp:    'M16 6l4 14 M12 6v14 M8 6l-4 14 M20 6H4',
  logout:       'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
};

function AdminNavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  const iconPath = ICONS[icon] ?? ICONS.dashboard;
  return (
    <a
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-white/15 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-fizza-soft' : 'text-white/50 group-hover:text-white/80'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {iconPath.split(' M').map((seg, i) => (
            <path key={i} d={i === 0 ? seg : 'M' + seg} />
          ))}
        </svg>
      </span>
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-fizza-soft shrink-0" />}
    </a>
  );
}

function AdminMobileNav({ active }: { active: AdminSection }) {
  return (
    <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-3 py-2">
      <label htmlFor="admin-section-mobile" className="sr-only">
        Admin section
      </label>
      <select
        id="admin-section-mobile"
        value={active}
        onChange={(e) => {
          window.location.href = adminSectionHref(e.target.value as AdminSection);
        }}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-800"
      >
        {ADMIN_SECTIONS.map((s) => (
          <option key={s.section} value={s.section}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const active = parseAdminSection(searchParams.get('section'));
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }, []);

  return (
    <div className="flex min-h-screen bg-fizza-bg">
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-fizza-primary shrink-0">
        <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-white/10">
          <Logo theme="dark" />
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-red-500/20 text-red-200">
            Admin
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
          {ADMIN_SECTIONS.map((item) => (
            <AdminNavLink
              key={item.section}
              href={adminSectionHref(item.section)}
              label={item.label}
              icon={item.icon}
              active={active === item.section}
            />
          ))}
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              {ICONS.logout.split(' M').map((seg, i) => (
                <path key={i} d={i === 0 ? seg : 'M' + seg} />
              ))}
            </svg>
            <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <AdminMobileNav active={active} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
