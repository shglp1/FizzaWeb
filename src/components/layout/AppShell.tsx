'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Logo } from './Logo';
import Link from 'next/link';

// ─── Mobile top bar ───────────────────────────────────────────────────────────

function MobileTopBar() {
  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-fizza-primary px-4 py-3">
      <Logo theme="dark" />
      {/* Shortcut to notifications */}
      <Link
        href="/notifications"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </Link>
    </header>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-fizza-bg">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Right panel */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile-only top bar */}
        <MobileTopBar />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-6">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
