'use client';

import { type ReactNode, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { Logo } from './Logo';
import {
  ADMIN_SECTIONS,
  ADMIN_SECTION_LABELS,
  adminSectionHref,
  parseAdminSection,
  type AdminSection,
} from '@/lib/adminNav';
import { ADMIN_MAIN_OFFSET, ADMIN_SIDEBAR_CLASSES } from '@/lib/ui/adminSidebarLayout';

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
  ticket:       'M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M9 9h.01 M15 9h.01',
  logout:       'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
};

const MOBILE_QUICK_SECTIONS: AdminSection[] = ['overview', 'trips', 'users', 'drivers', 'audit'];

function NavIcon({ icon }: { icon: string }) {
  const iconPath = ICONS[icon] ?? ICONS.dashboard;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPath.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

function AdminNavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 min-h-[44px] ${
        active
          ? 'bg-white/15 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-fizza-soft' : 'text-white/50 group-hover:text-white/80'}`}>
        <NavIcon icon={icon} />
      </span>
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-fizza-soft shrink-0" />}
    </a>
  );
}

function SignOutButton({
  loggingOut,
  onLogout,
  className = '',
}: {
  loggingOut: boolean;
  onLogout: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loggingOut}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 min-h-[44px] ${className}`}
    >
      <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>
    </button>
  );
}

function MobileTopBar({
  title,
  onMenuOpen,
}: {
  title: string;
  onMenuOpen: () => void;
}) {
  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 py-3 safe-area-top">
      <button
        type="button"
        onClick={onMenuOpen}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
        aria-label="Open admin menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fizza-secondary">Admin Console</p>
        <h1 className="text-base font-bold text-gray-900 truncate">{title}</h1>
      </div>
      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Admin</span>
    </header>
  );
}

function MobileBottomNav({ active }: { active: AdminSection }) {
  const items = MOBILE_QUICK_SECTIONS.map((section) => {
    const nav = ADMIN_SECTIONS.find((s) => s.section === section);
    return nav ? { ...nav, href: adminSectionHref(section) } : null;
  }).filter(Boolean) as { label: string; section: AdminSection; icon: string; href: string }[];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm safe-area-bottom"
      aria-label="Quick admin navigation"
    >
      <div className="flex items-stretch justify-around px-1 pt-1 pb-1">
        {items.map((item) => {
          const isActive = active === item.section;
          return (
            <a
              key={item.section}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? 'text-fizza-primary' : 'text-gray-500'
              }`}
            >
              <span className={isActive ? 'text-fizza-secondary' : 'text-gray-400'}>
                <NavIcon icon={item.icon} />
              </span>
              <span className="truncate max-w-[64px]">{item.label.split(' ')[0]}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function MobileNavDrawer({
  open,
  onClose,
  active,
  loggingOut,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  active: AdminSection;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close menu" />
      <aside className="relative flex h-full w-[min(100%,280px)] flex-col bg-fizza-primary shadow-2xl">
        <div className={ADMIN_SIDEBAR_CLASSES.header}>
          <Logo theme="dark" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className={ADMIN_SIDEBAR_CLASSES.nav}>
          {ADMIN_SECTIONS.map((item) => (
            <AdminNavLink
              key={item.section}
              href={adminSectionHref(item.section)}
              label={item.label}
              icon={item.icon}
              active={active === item.section}
              onNavigate={onClose}
            />
          ))}
        </nav>
        <div className={ADMIN_SIDEBAR_CLASSES.footer}>
          <SignOutButton loggingOut={loggingOut} onLogout={onLogout} />
        </div>
      </aside>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const active = parseAdminSection(searchParams.get('section'));
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }, []);

  return (
    <div className="min-h-screen bg-fizza-bg">
      <aside className={ADMIN_SIDEBAR_CLASSES.root}>
        <div className={ADMIN_SIDEBAR_CLASSES.header}>
          <Logo theme="dark" />
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-red-500/20 text-red-200">
            Admin
          </span>
        </div>

        <nav className={ADMIN_SIDEBAR_CLASSES.nav}>
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

        <div className={ADMIN_SIDEBAR_CLASSES.footer}>
          <SignOutButton loggingOut={loggingOut} onLogout={handleLogout} />
        </div>
      </aside>

      <div className={`flex min-h-screen flex-col min-w-0 ${ADMIN_MAIN_OFFSET}`}>
        <MobileTopBar title={ADMIN_SECTION_LABELS[active]} onMenuOpen={() => setMobileNavOpen(true)} />
        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          active={active}
          loggingOut={loggingOut}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8 overflow-x-hidden min-h-0">
          <div className="mx-auto max-w-6xl w-full">{children}</div>
        </main>

        <MobileBottomNav active={active} />
      </div>
    </div>
  );
}
