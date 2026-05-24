'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, StatusBadge } from '@/components/ui';
import {
  ParentPageHeader,
  ParentHeroCard,
  ParentKpiGrid,
  ParentKpiCard,
  ParentAttentionList,
  ParentSectionCard,
  ParentQuickActionGrid,
  ParentDriverBlock,
  ParentLoadingState,
  ParentErrorState,
  type ParentAttentionItem,
} from '@/components/parent/ParentUI';
import { tripService } from '@/services/tripService';
import { walletService } from '@/services/walletService';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';
import { TRIP_STATUS_LABEL, type TripStatus } from '@/lib/trips/tripLifecycle';
import { formatSarParent, formatTripDateTime, formatDriverSummary, formatVehicleSummary, getTrackingAvailability, trackingAvailabilityLabel } from '@/lib/parent/parentFormatters';
import { emergencyContactComplete, hasSpecialNeedsIndicator, riderProfileComplete } from '@/lib/riders/riderExposure';
import {
  Bell, CalendarDays, Car, ClipboardList, CreditCard, MapPin, MessageSquare, Shield, UserPlus, Users, Wallet,
} from 'lucide-react';

type Trip = {
  id: string;
  status: string;
  scheduledDate?: string;
  scheduledPickupTime?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  rider?: { name: string; specialNeeds?: boolean };
  driver?: { profile?: { fullName: string; avatarUrl?: string | null } | null; rating?: string | number | null } | null;
  vehicle?: { model?: string | null; color?: string | null; plateNumber?: string | null; capacity?: number | null } | null;
};

type Wallet = { balanceSar: number | string; updatedAt?: string };
type Subscription = { id: string; status: string; paymentStatus?: string; package?: { name: string } };
type Rider = {
  id: string; name: string; isActive: boolean; school?: string | null;
  specialNeeds?: boolean; emergencyContactName?: string | null; emergencyContactPhone?: string | null;
  relationship?: string;
};

function tripStatusVariant(s: string): 'success' | 'warning' | 'info' | 'danger' | 'gray' {
  const m: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'gray'> = {
    COMPLETED: 'success', ON_THE_WAY: 'info', PICKED_UP: 'info',
    SCHEDULED: 'warning', DRIVER_ASSIGNED: 'warning', CANCELLED: 'danger',
  };
  return m[s] ?? 'gray';
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
      if (meRes.status === 401) { if (!cancelled) router.replace('/login'); return; }
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
    })().catch(() => { if (!cancelled) { setError('Unable to connect.'); setLoading(false); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSub = subs.find((s) => s.status === 'ACTIVE' || s.status === 'active');
  const pendingSub = subs.find((s) => s.paymentStatus === 'PENDING' || s.status === 'PENDING');
  const activeRiders = riders.filter((r) => r.isActive);
  const nextTrip = trips[0] ?? null;
  const trackable = nextTrip && ['PRE_TRIP', 'ON_THE_WAY', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'DRIVER_ASSIGNED'].includes(nextTrip.status);
  const nextDriver = formatDriverSummary(nextTrip?.driver);
  const tracking = nextTrip
    ? getTrackingAvailability(nextTrip.status, nextTrip.scheduledPickupTime ?? null, Boolean(nextTrip.driver), 20)
    : null;

  const attentionItems = useMemo((): ParentAttentionItem[] => {
    const items: ParentAttentionItem[] = [];
    if (pendingSub) {
      items.push({ id: 'pay', title: 'Subscription payment pending', description: 'Complete payment to activate your transport plan.', href: '/subscriptions', tone: 'warning' });
    }
    if (activeRiders.length === 0) {
      items.push({ id: 'riders', title: 'Add a family member', description: 'Riders are required before you can create a subscription.', href: '/riders', tone: 'info' });
    }
    for (const r of activeRiders) {
      if (!riderProfileComplete(r)) {
        items.push({ id: `rider-${r.id}`, title: `${r.name}: profile incomplete`, description: 'Add school and emergency contact for safer transport.', href: '/riders', tone: 'warning' });
        break;
      }
    }
    if (nextTrip && !nextTrip.driver) {
      items.push({ id: 'driver', title: 'Driver not yet assigned', description: `${nextTrip.rider?.name ?? 'Rider'} trip — we are matching a driver.`, href: '/trips', tone: 'info' });
    }
    if (nextTrip?.scheduledPickupTime) {
      const mins = (new Date(nextTrip.scheduledPickupTime).getTime() - Date.now()) / 60000;
      if (mins > 0 && mins <= 60) {
        items.push({ id: 'soon', title: 'Trip starts soon', description: formatTripDateTime(nextTrip.scheduledPickupTime), href: `/tracking/${nextTrip.id}`, tone: 'warning' });
      }
    }
    return items;
  }, [pendingSub, activeRiders, nextTrip]);

  const quickActions = [
    { href: '/riders', icon: UserPlus, title: 'Add rider', sub: 'Family members', bg: 'bg-emerald-50 text-fizza-secondary' },
    { href: '/subscriptions/new', icon: ClipboardList, title: 'New subscription', sub: 'Create a route', bg: 'bg-blue-50 text-blue-600' },
    { href: '/wallet', icon: CreditCard, title: 'Wallet top-up', sub: formatSarParent(wallet?.balanceSar), bg: 'bg-amber-50 text-amber-600' },
    { href: '/safety', icon: Shield, title: 'Safety report', sub: 'Report an issue', bg: 'bg-red-50 text-red-500' },
    { href: '/notifications', icon: Bell, title: 'Notifications', sub: 'Updates and alerts', bg: 'bg-gray-100 text-gray-600' },
    { href: '/trips', icon: MapPin, title: 'All trips', sub: `${trips.length} upcoming`, bg: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <AppShell>
      <ParentPageHeader
        title="Family Dashboard"
        subtitle="Everything you need for safe, scheduled transport"
        action={<Link href="/subscriptions/new"><Button variant="primary" size="sm">New subscription</Button></Link>}
        meta={<span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">{activeRiders.length} active riders</span>}
      />

      {loading ? (
        <ParentLoadingState message="Loading your dashboard…" />
      ) : error ? (
        <ParentErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-6 max-w-6xl">
          <ParentHeroCard
            variant={nextTrip ? 'brand' : 'neutral'}
            title={nextTrip ? `${nextTrip.rider?.name ?? 'Rider'} — next trip` : 'Welcome back'}
            subtitle={
              nextTrip
                ? `${formatTripDateTime(nextTrip.scheduledPickupTime ?? nextTrip.scheduledDate ?? null)}`
                : 'Create a subscription to schedule recurring school or family transport.'
            }
            badge={nextTrip ? (
              <StatusBadge variant={tripStatusVariant(nextTrip.status)}>
                {TRIP_STATUS_LABEL[nextTrip.status as TripStatus] ?? nextTrip.status.replace(/_/g, ' ').toLowerCase()}
              </StatusBadge>
            ) : undefined}
            details={nextTrip ? (
              <>
                <p>Pickup: {nextTrip.pickupLocation ?? '—'}</p>
                <p>Drop-off: {nextTrip.dropoffLocation ?? '—'}</p>
                {nextTrip.driver ? (
                  <ParentDriverBlock name={nextDriver.name} rating={nextDriver.rating} avatarUrl={nextDriver.avatarUrl} />
                ) : (
                  <p className="text-white/90">Driver is being assigned</p>
                )}
                {tracking && <p className="text-sm font-medium">{trackingAvailabilityLabel(tracking)}</p>}
                {nextTrip.vehicle && <p className="text-sm opacity-90">{formatVehicleSummary(nextTrip.vehicle)}</p>}
              </>
            ) : undefined}
            actions={nextTrip ? (
              <>
                {trackable && (
                  <Link href={`/tracking/${nextTrip.id}`}><Button variant="secondary" size="sm">Track trip</Button></Link>
                )}
                <Link href={`/tracking/${nextTrip.id}?chat=1`}><Button variant="outline" size="sm" className="border-white/40 text-white hover:bg-white/10"><MessageSquare className="h-4 w-4 mr-1 inline" />Message driver</Button></Link>
                <Link href="/trips"><Button variant="outline" size="sm" className="border-white/40 text-white hover:bg-white/10">View trip</Button></Link>
              </>
            ) : (
              <Link href="/subscriptions/new"><Button variant="primary" size="sm">Create subscription</Button></Link>
            )}
          />

          <ParentKpiGrid columns={4}>
            <ParentKpiCard label="Wallet balance" value={formatSarParent(wallet?.balanceSar)} icon={Wallet} />
            <ParentKpiCard label="Active riders" value={activeRiders.length} helper="Family members" icon={Users} color="#14A34A" />
            <ParentKpiCard label="Upcoming trips" value={trips.length} helper="Scheduled" icon={CalendarDays} color="#1D4ED8" />
            <ParentKpiCard label="Active plan" value={activeSub?.package?.name ?? 'None'} helper={activeSub ? 'Subscribed' : 'No active plan'} icon={ClipboardList} />
          </ParentKpiGrid>

          {attentionItems.length > 0 && <ParentAttentionList items={attentionItems} />}

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ParentSectionCard
                title="Upcoming trips"
                action={<Link href="/trips" className="text-xs font-medium text-fizza-secondary hover:underline">View all</Link>}
              >
                {trips.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <Car className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden />
                    <p className="font-medium text-gray-700">No upcoming trips yet</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Trips are generated from your active subscription.</p>
                    <Link href="/subscriptions" className="btn-primary btn-sm inline-block">Browse plans</Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {trips.slice(0, 5).map((trip) => {
                      const d = formatDriverSummary(trip.driver);
                      return (
                        <li key={trip.id} className="px-5 py-4 hover:bg-gray-50/80 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{trip.rider?.name ?? 'Rider'}</p>
                                {hasSpecialNeedsIndicator(trip.rider ?? {}) && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Special needs</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{formatTripDateTime(trip.scheduledPickupTime ?? trip.scheduledDate ?? null)}</p>
                              {trip.driver ? (
                                <p className="text-xs text-gray-600 mt-1">{d.name}{d.rating !== '—' ? ` · ${d.rating}` : ''} · {formatVehicleSummary(trip.vehicle)}</p>
                              ) : (
                                <p className="text-xs text-amber-600 mt-1">Driver is being assigned</p>
                              )}
                            </div>
                            <StatusBadge variant={tripStatusVariant(trip.status)}>
                              {TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status}
                            </StatusBadge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ParentSectionCard>
            </div>
            <div className="space-y-4">
              <ParentSectionCard title="Quick actions">
                <div className="p-4"><ParentQuickActionGrid items={quickActions} /></div>
              </ParentSectionCard>
              {activeRiders.length > 0 && (
                <ParentSectionCard title="Family" action={<Link href="/riders" className="text-xs font-medium text-fizza-secondary">Manage</Link>}>
                  <ul className="divide-y divide-gray-50">
                    {activeRiders.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-fizza-primary">{r.name.charAt(0)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                          {r.school && <p className="text-xs text-gray-400 truncate">{r.school}</p>}
                        </div>
                        {!emergencyContactComplete(r) && <span className="text-[10px] text-amber-600">Incomplete</span>}
                      </li>
                    ))}
                  </ul>
                </ParentSectionCard>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
