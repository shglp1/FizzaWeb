'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  CalendarDays,
  Car,
  ClipboardList,
  CreditCard,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id: string;
  status: string;
  scheduledDate?: string;
  scheduledPickupTime?: string;
  rider?: { name: string };
};

// Wallet API shape: { data: { wallet: { balanceSar, ... }, loyaltyPoints } }
type Wallet = { balanceSar: number };
type Subscription = { id: string; status: string; package?: { name: string } };
type Rider = { id: string; name: string; isActive: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tripStatusVariant(s: string): 'success' | 'warning' | 'info' | 'danger' | 'gray' {
  const m: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'gray'> = {
    COMPLETED: 'success', ON_THE_WAY: 'info', PICKED_UP: 'info',
    SCHEDULED: 'warning', DRIVER_ASSIGNED: 'warning', CANCELLED: 'danger',
  };
  return m[s] ?? 'gray';
}

function fmtPickup(trip: Trip): string {
  if (trip.scheduledPickupTime) {
    return new Date(trip.scheduledPickupTime).toLocaleString('en-SA', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  if (trip.scheduledDate) {
    return new Date(trip.scheduledDate).toLocaleDateString('en-SA', {
      month: 'short', day: 'numeric',
    });
  }
  return '—';
}

function safeBalance(wallet: Wallet | null): string {
  const n = wallet?.balanceSar ?? 0;
  return `SAR ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const meRes = await fetch('/api/me');
      if (meRes.status === 401) {
        if (!cancelled) router.replace('/login');
        return;
      }

      const { data: me } = (await meRes.json()) as {
        data?: { role?: string; driverState?: string };
      };

      if (!cancelled) {
        if (me?.role === 'ADMIN') {
          router.replace('/admin');
          return;
        }
        if (me?.role === 'DRIVER') {
          router.replace('/driver/dashboard');
          return;
        }
        if (me?.driverState === 'DRIVER_APPLICANT') {
          router.replace('/driver-application');
          return;
        }
      }

      const results = await Promise.allSettled([
        tripService.list('upcoming'),
        walletService.getWallet(),
        subscriptionService.list(),
        riderService.list(),
      ]);

      if (cancelled) return;

      const [t, w, s, r] = results.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
      );

      if (t?.data) setTrips(Array.isArray(t.data) ? t.data.slice(0, 5) : []);
      if (w?.data?.wallet) setWallet(w.data.wallet);
      if (s?.data) setSubs(Array.isArray(s.data) ? s.data : []);
      if (r?.data) setRiders(Array.isArray(r.data) ? r.data : []);

      const authFailed = results.some(
        (result) =>
          result.status === 'fulfilled' &&
          result.value &&
          typeof result.value === 'object' &&
          'error' in result.value &&
          (result.value as { error?: { message?: string } }).error?.message === 'Unauthorized',
      );
      if (authFailed) {
        router.replace('/login');
        return;
      }

      const anyData = Boolean(t?.data || w?.data || s?.data || r?.data);
      if (!anyData) setError('Failed to load dashboard data.');
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError('Unable to connect.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSub = subs.find((s) => s.status === 'active' || s.status === 'ACTIVE');
  const activeRiders = riders.filter((r) => r.isActive).length;
  const upcomingTrips = trips.filter(
    (t) => t.status === 'SCHEDULED' || t.status === 'DRIVER_ASSIGNED',
  ).length;

  return (
    <AppShell>
      <PageHeader title="Family Dashboard" subtitle="Your family transportation overview" />

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
              value={safeBalance(wallet)}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7" /></svg>}
              color="#0B683A"
            />
            <StatCard
              label="Family Members"
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
            {/* Upcoming trips */}
            <div className="lg:col-span-2">
              <Card>
                <div className="section-header">
                  <h2 className="text-base font-semibold text-gray-900">Upcoming Trips</h2>
                  <a href="/trips" className="text-sm text-fizza-secondary hover:text-fizza-primary font-medium transition-colors">View all →</a>
                </div>

                {trips.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-3 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Car className="h-6 w-6 text-gray-400" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">No upcoming trips</p>
                      <p className="text-xs text-gray-400 mt-0.5">Start with a subscription plan</p>
                    </div>
                    <a href="/subscriptions" className="btn-primary btn-sm">Browse Plans</a>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {trips.map((trip) => (
                      <div key={trip.id} className="flex items-center gap-3 py-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-sm font-bold text-fizza-primary shrink-0">
                          {trip.rider?.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{trip.rider?.name ?? 'Unknown rider'}</p>
                          <p className="text-xs text-gray-400">{fmtPickup(trip)}</p>
                        </div>
                        <StatusBadge variant={tripStatusVariant(trip.status)}>
                          {trip.status.replace(/_/g, ' ').toLowerCase()}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Quick actions + family members */}
            <div className="flex flex-col gap-4">
              <Card>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {([
                    { href: '/riders',        Icon: Users,         title: 'Add Family Member',  sub: 'Manage family members',     bg: 'bg-emerald-50 text-fizza-secondary' },
                    { href: '/subscriptions', Icon: ClipboardList, title: activeSub ? 'Manage Plan' : 'Create Subscription', sub: activeSub?.package?.name ?? 'No active plan', bg: 'bg-blue-50 text-blue-600' },
                    { href: '/wallet',        Icon: CreditCard,    title: 'Top Up Wallet',        sub: safeBalance(wallet),          bg: 'bg-amber-50 text-amber-600' },
                    { href: '/trips',         Icon: CalendarDays,  title: 'View Trips',            sub: `${upcomingTrips} upcoming`,  bg: 'bg-purple-50 text-purple-600' },
                    { href: '/safety',        Icon: Shield,        title: 'Safety Report',         sub: 'Report an issue',            bg: 'bg-red-50 text-red-500' },
                  ] as { href: string; Icon: LucideIcon; title: string; sub: string; bg: string }[]).map((item) => (
                    <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors group">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${item.bg}`}>
                        <item.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
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
                    <h2 className="text-sm font-semibold text-gray-900">Family Members</h2>
                    <a href="/riders" className="text-xs text-fizza-secondary font-medium">Manage</a>
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
