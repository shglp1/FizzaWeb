'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  Button,
} from '@/components/ui';
import {
  HeroPanel,
  StatsGrid,
  AttentionList,
  EnterpriseCard,
  SectionHeader,
} from '@/components/ui/enterprise';
import { tripService } from '@/services/tripService';
import { walletService } from '@/services/walletService';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';
import { TRIP_STATUS_LABEL } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import {
  Bell,
  CalendarDays,
  Car,
  ClipboardList,
  CreditCard,
  MapPin,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';

type Trip = {
  id: string;
  status: string;
  scheduledDate?: string;
  scheduledPickupTime?: string;
  pickupLocation?: string;
  rider?: { name: string };
  driver?: { profile?: { fullName: string } | null } | null;
};

type Wallet = { balanceSar: number };
type Subscription = { id: string; status: string; package?: { name: string } };
type Rider = { id: string; name: string; isActive: boolean; school?: string | null };

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
    return new Date(trip.scheduledDate).toLocaleDateString('en-SA', { month: 'short', day: 'numeric' });
  }
  return '—';
}

function safeBalance(wallet: Wallet | null): string {
  const n = wallet?.balanceSar ?? 0;
  return `SAR ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

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
      const { data: me } = (await meRes.json()) as { data?: { role?: string; driverState?: string } };
      if (!cancelled) {
        if (me?.role === 'ADMIN') { router.replace('/admin'); return; }
        if (me?.role === 'DRIVER') { router.replace('/driver/dashboard'); return; }
        if (me?.driverState === 'DRIVER_APPLICANT') { router.replace('/driver-application'); return; }
      }
      const results = await Promise.allSettled([
        tripService.list('upcoming'),
        walletService.getWallet(),
        subscriptionService.list(),
        riderService.list(),
      ]);
      if (cancelled) return;
      const [t, w, s, r] = results.map((x) => (x.status === 'fulfilled' ? x.value : null));
      if (t?.data) setTrips(Array.isArray(t.data) ? t.data.slice(0, 8) : []);
      if (w?.data?.wallet) setWallet(w.data.wallet);
      if (s?.data) setSubs(Array.isArray(s.data) ? s.data : []);
      if (r?.data) setRiders(Array.isArray(r.data) ? r.data : []);
      if (!(t?.data || w?.data || s?.data || r?.data)) setError('Failed to load dashboard data.');
      setLoading(false);
    })().catch(() => {
      if (!cancelled) { setError('Unable to connect.'); setLoading(false); }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSub = subs.find((s) => s.status === 'active' || s.status === 'ACTIVE');
  const pendingSub = subs.find((s) => s.status === 'PENDING_PAYMENT' || s.status === 'pending_payment');
  const activeRiders = riders.filter((r) => r.isActive);
  const nextTrip = trips[0] ?? null;
  const trackable = nextTrip && ['PRE_TRIP', 'ON_THE_WAY', 'PICKED_UP', 'EN_ROUTE_DROPOFF'].includes(nextTrip.status);

  const attentionItems = [
    ...(pendingSub ? [{
      id: 'pay',
      title: 'Subscription payment pending',
      description: 'Complete payment to activate your transport plan.',
      href: '/subscriptions',
      tone: 'warning' as const,
    }] : []),
    ...(activeRiders.length === 0 ? [{
      id: 'riders',
      title: 'Add a family member',
      description: 'Riders are required before you can create a subscription.',
      href: '/riders',
      tone: 'info' as const,
    }] : []),
    ...(nextTrip ? [{
      id: 'trip',
      title: `Next pickup: ${nextTrip.rider?.name ?? 'Rider'}`,
      description: fmtPickup(nextTrip),
      href: trackable ? `/tracking/${nextTrip.id}` : '/trips',
      tone: 'info' as const,
    }] : []),
  ];

  const quickActions = [
    { href: '/riders' as const, Icon: Users, title: 'Family members', sub: `${activeRiders.length} active`, bg: 'bg-emerald-50 text-fizza-secondary' },
    { href: '/subscriptions' as const, Icon: ClipboardList, title: activeSub ? 'Your plan' : 'New subscription', sub: activeSub?.package?.name ?? 'Get started', bg: 'bg-blue-50 text-blue-600' },
    { href: '/wallet' as const, Icon: CreditCard, title: 'Wallet', sub: safeBalance(wallet), bg: 'bg-amber-50 text-amber-600' },
    { href: '/tracking' as const, Icon: MapPin, title: 'Live tracking', sub: trackable ? 'Available now' : 'When trip starts', bg: 'bg-purple-50 text-purple-600' },
    { href: '/safety' as const, Icon: Shield, title: 'Safety', sub: 'Report an issue', bg: 'bg-red-50 text-red-500' },
    { href: '/notifications' as const, Icon: Bell, title: 'Notifications', sub: 'Updates & alerts', bg: 'bg-gray-100 text-gray-600' },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Family dashboard"
        subtitle="Everything you need for safe, scheduled transport"
        action={
          <Link href="/subscriptions/new">
            <Button variant="primary" size="sm">New subscription</Button>
          </Link>
        }
      />

      {loading ? (
        <LoadingState message="Loading your dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-6">
          <HeroPanel
            variant={nextTrip ? 'brand' : 'neutral'}
            title={nextTrip ? `${nextTrip.rider?.name ?? 'Rider'} — next trip` : 'Welcome back'}
            subtitle={
              nextTrip
                ? `${fmtPickup(nextTrip)} · ${nextTrip.pickupLocation ?? 'Pickup scheduled'}`
                : 'Create a subscription to schedule recurring school or family transport.'
            }
            badge={
              nextTrip ? (
                <StatusBadge variant={tripStatusVariant(nextTrip.status)}>
                  {TRIP_STATUS_LABEL[nextTrip.status as TripStatus] ?? nextTrip.status.replace(/_/g, ' ').toLowerCase()}
                </StatusBadge>
              ) : undefined
            }
            actions={
              nextTrip ? (
                <>
                  {trackable && (
                    <Link href={`/tracking/${nextTrip.id}`}>
                      <Button variant="secondary" size="sm">Track live</Button>
                    </Link>
                  )}
                  <Link href="/trips">
                    <Button variant="outline" size="sm" className={nextTrip ? 'border-white/40 text-white hover:bg-white/10' : ''}>
                      All trips
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href="/subscriptions/new">
                  <Button variant="primary" size="sm">Create subscription</Button>
                </Link>
              )
            }
          />

          <StatsGrid
            columns={4}
            items={[
              { label: 'Wallet', value: safeBalance(wallet), icon: Wallet, color: '#0B683A' },
              { label: 'Family', value: activeRiders.length, helper: 'Active riders', icon: Users, color: '#14A34A' },
              { label: 'Upcoming', value: trips.length, helper: 'Scheduled trips', icon: CalendarDays, color: '#1D4ED8' },
              { label: 'Plan', value: activeSub?.package?.name ?? 'None', helper: activeSub ? 'Active' : 'No active plan', icon: ClipboardList, color: activeSub ? '#15803D' : '#6B7280' },
            ]}
          />

          {attentionItems.length > 0 && <AttentionList items={attentionItems} />}

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EnterpriseCard
                header={<SectionHeader title="Upcoming trips" action={<Link href="/trips" className="text-sm font-medium text-fizza-secondary hover:underline">View all</Link>} className="mb-0" />}
                padding="none"
              >
                {trips.length === 0 ? (
                  <div className="flex flex-col items-center py-12 px-6 text-center">
                    <Car className="h-10 w-10 text-gray-300 mb-3" aria-hidden />
                    <p className="font-medium text-gray-700">No upcoming trips yet</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Trips are generated from your active subscription.</p>
                    <Link href="/subscriptions" className="btn-primary btn-sm">Browse plans</Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {trips.map((trip) => (
                      <li key={trip.id} className="flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-gray-50/80 transition-colors">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-sm font-bold text-fizza-primary shrink-0">
                          {trip.rider?.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{trip.rider?.name ?? 'Rider'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmtPickup(trip)}</p>
                          {trip.driver?.profile?.fullName && (
                            <p className="text-xs text-gray-400 mt-0.5">Driver: {trip.driver.profile.fullName}</p>
                          )}
                        </div>
                        <StatusBadge variant={tripStatusVariant(trip.status)}>
                          {TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status.replace(/_/g, ' ').toLowerCase()}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </EnterpriseCard>
            </div>

            <div className="space-y-4">
              <EnterpriseCard header={<SectionHeader title="Quick actions" className="mb-0" />} padding="none">
                <div className="divide-y divide-gray-50">
                  {quickActions.map((item) => (
                    <Link key={item.href} href={item.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-emerald-50/40 transition-colors">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${item.bg}`}>
                        <item.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                        <p className="text-xs text-gray-500 truncate">{item.sub}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </EnterpriseCard>

              {activeRiders.length > 0 && (
                <EnterpriseCard header={<SectionHeader title="Family" action={<Link href="/riders" className="text-xs font-medium text-fizza-secondary">Manage</Link>} className="mb-0" />} padding="none">
                  <ul className="divide-y divide-gray-50">
                    {activeRiders.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-fizza-primary">
                          {r.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                          {r.school && <p className="text-xs text-gray-400 truncate">{r.school}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </EnterpriseCard>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
