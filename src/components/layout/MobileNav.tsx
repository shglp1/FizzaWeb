'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─── Inline SVG icon ──────────────────────────────────────────────────────────

function NavIcon({ paths, filled = false }: { paths: string; filled?: boolean }) {
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

// ─── Mobile nav items (5 tabs) ────────────────────────────────────────────────

const ITEMS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  },
  {
    label: 'Trips',
    href: '/trips',
    icon: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4',
  },
  {
    label: 'Wallet',
    href: '/wallet',
    icon: 'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  },
  {
    label: 'Alerts',
    href: '/notifications',
    icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 safe-area-pb">
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-fizza-secondary' : 'text-gray-400'
              }`}
            >
              <NavIcon paths={item.icon} filled={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
