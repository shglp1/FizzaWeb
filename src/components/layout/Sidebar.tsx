'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Logo } from './Logo';

// ─── Icon components (inline SVG, no external dep) ───────────────────────────

function Icon({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
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
} as const;

type IconKey = keyof typeof ICONS;

// ─── Nav items definition ─────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: IconKey;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',          icon: 'dashboard' },
  { label: 'Riders',           href: '/riders',             icon: 'riders' },
  { label: 'Subscriptions',    href: '/subscriptions',      icon: 'subscriptions' },
  { label: 'Trips',            href: '/trips',              icon: 'trips' },
  { label: 'Wallet',           href: '/wallet',             icon: 'wallet' },
  { label: 'Tracking',         href: '/tracking',           icon: 'tracking' },
  { label: 'Safety',           href: '/safety',             icon: 'safety' },
  { label: 'Notifications',    href: '/notifications',      icon: 'notifications' },
];

const SECONDARY_ITEMS: NavItem[] = [
  { label: 'Profile',          href: '/profile',            icon: 'profile' },
  { label: 'Admin Panel',      href: '/admin',              icon: 'admin',    adminOnly: true },
];

// ─── Session decode (display only — no sig verification) ─────────────────────

function decodeRole(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)fizza-session=([^;]+)/);
    if (!match) return null;
    const b64 = match[1].split('.')[1];
    const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

// ─── Single nav link ──────────────────────────────────────────────────────────

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <a
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-fizza-secondary/20 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span
        className={`shrink-0 transition-colors ${
          active ? 'text-fizza-soft' : 'text-white/50 group-hover:text-white/80'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[item.icon].split(' M').map((seg, i) => (
            <path key={i} d={i === 0 ? seg : 'M' + seg} />
          ))}
        </svg>
      </span>
      <span className="truncate">{item.label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-fizza-soft shrink-0" />
      )}
    </a>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { setRole(decodeRole()); }, []);

  const isActive = useCallback(
    (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href)),
    [pathname],
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const visibleMain = NAV_ITEMS;
  const visibleSecondary = SECONDARY_ITEMS.filter(
    (item) => !item.adminOnly || role === 'admin',
  );

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-fizza-primary shrink-0">
      {/* Logo area */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <Logo theme="dark" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
        {visibleMain.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {/* Divider before secondary items */}
        <div className="my-3 border-t border-white/10" />

        {visibleSecondary.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      {/* Bottom — logout */}
      <div className="px-3 pb-4 pt-2 border-t border-white/10">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
        >
          <span className="shrink-0">
            <Icon d={ICONS.logout} />
          </span>
          <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>
        </button>
      </div>
    </aside>
  );
}
