'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  StatusBadge,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import { tripService } from '@/services/tripService';
import { walletService } from '@/services/walletService';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id: string;
  status: string;
  scheduledAt: string;
  rider?: { name: string };
};

type Wallet = { balance: number; currency?: string };
type Subscription = { id: string; status: string; package?: { name: string } };
type Rider = { id: string; name: string; isActive: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tripStatusVariant(s: string): 'success' | 'warning' | 'info' | 'danger' | 'gray' {
  const m: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'gray'> = {
    completed: 'success', in_progress: 'info', scheduled: 'warning', cancelled: 'danger',
  };
  return m[s] ?? 'gray';
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-SA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      tripService.list(),
      walletService.getWallet(),
      subscriptionService.list(),
      riderService.list(),
    ]).then(([t, w, s, r]) => {
      if (t.data) setTrips(t.data.slice(0, 5));
      if (w.data) setWallet(w.data);
      if (s.data) setSubs(s.data);
      if (r.data) setRiders(r.data);
      if (!t.data && !w.data) setError('Failed to load dashboard data.');
      setLoading(false);
    }).catch(() => { setError('Unable to connect.'); setLoading(false); });
  }, []);

  const activeSub = subs.find((s) => s.status === 'active');
  const activeRiders = riders.filter((r) => r.isActive).length;
  const upcomingTrips = trips.filter((t) => t.status === 'scheduled').length;

  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Welcome back — here's your family overview" />

      {loading ? (
        <LoadingState message="Loading your dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Wallet Balance"
              value={`${wallet?.currency ?? 'SAR'} ${(wallet?.balance ?? 0).toFixed(2)}`}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7" /></svg>}
              color="#0B683A"
            />
            <StatCard
              label="Active Riders"
              value={activeRiders}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>}
              color="#14A34A"
            />
            <StatCard
              label="Upcoming Trips"
              value={upcomingTrips}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              color="#1D4ED8"
            />
            <StatCard
              label="Subscription"
              value={activeSub ? (activeSub.package?.name ?? 'Active') : 'None'}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
              color={activeSub ? '#15803D' : '#6B7280'}
            />
          </div>

          {/* Body */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Recent trips */}
            <div className="lg:col-span-2">
              <Card>
                <div className="section-header">
                  <h2 className="text-base font-semibold text-gray-900">Recent Trips</h2>
                  <Link href="/trips" className="text-sm text-fizza-secondary hover:text-fizza-primary font-medium transition-colors">View all →</Link>
                </div>

                {trips.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-3 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">🚗</div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">No trips yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">Start with a subscription plan</p>
                    </div>
                    <Link href="/subscriptions" className="btn-primary btn-sm">Browse Plans</Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {trips.map((trip) => (
                      <div key={trip.id} className="flex items-center gap-3 py-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-sm font-bold text-fizza-primary shrink-0">
                          {trip.rider?.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{trip.rider?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{fmt(trip.scheduledAt)}</p>
                        </div>
                        <StatusBadge variant={tripStatusVariant(trip.status)}>
                          {trip.status.replace(/_/g, ' ')}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Sidebar: quick links + riders */}
            <div className="flex flex-col gap-4">
              <Card>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { href: '/riders', emoji: '👤', title: 'Add a Rider', sub: 'Manage family members', bg: 'bg-emerald-50 text-fizza-secondary' },
                    { href: '/subscriptions', emoji: '📋', title: activeSub ? 'Manage Plan' : 'Pick a Plan', sub: activeSub?.package?.name ?? 'No active plan', bg: 'bg-blue-50 text-blue-600' },
                    { href: '/wallet', emoji: '💳', title: 'Wallet', sub: wallet ? `SAR ${wallet.balance.toFixed(2)}` : 'Check balance', bg: 'bg-amber-50 text-amber-600' },
                    { href: '/safety', emoji: '🛡️', title: 'Safety Report', sub: 'Report an issue', bg: 'bg-red-50 text-red-500' },
                  ].map((item) => (
                    <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors group">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base shrink-0 ${item.bg}`}>
                        {item.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                        <p className="text-xs text-gray-400 truncate">{item.sub}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </Card>

              {riders.length > 0 && (
                <Card padding="sm">
                  <div className="section-header px-1">
                    <h2 className="text-sm font-semibold text-gray-900">My Riders</h2>
                    <Link href="/riders" className="text-xs text-fizza-secondary font-medium">Manage</Link>
                  </div>
                  <div className="space-y-1 mt-1">
                    {riders.slice(0, 4).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-1 py-1.5">
                        <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-fizza-primary shrink-0">
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700 truncate flex-1">{r.name}</span>
                        <Badge variant={r.isActive ? 'success' : 'gray'} className="text-[10px]">
                          {r.isActive ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
