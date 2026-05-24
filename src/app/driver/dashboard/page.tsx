'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader, StatCard, Card, StatusBadge, Button, LoadingState, ErrorState,
} from '@/components/ui';
import { tripService } from '@/services/tripService';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  ClipboardList,
  MapPin,
  Shield,
  UserRound,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TripStatus =
  | 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'PRE_TRIP' | 'ON_THE_WAY'
  | 'ARRIVED_PICKUP' | 'PICKED_UP' | 'EN_ROUTE_DROPOFF' | 'ARRIVED_DROPOFF'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

type Trip = {
  id: string;
  status: TripStatus;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { name: string; school: string | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRIP_VARIANT: Record<TripStatus, 'warning' | 'info' | 'purple' | 'success' | 'danger' | 'orange'> = {
  SCHEDULED:        'warning',
  DRIVER_ASSIGNED:  'info',
  PRE_TRIP:         'purple',
  ON_THE_WAY:       'purple',
  ARRIVED_PICKUP:   'orange',
  PICKED_UP:        'orange',
  EN_ROUTE_DROPOFF: 'purple',
  ARRIVED_DROPOFF:  'orange',
  COMPLETED:        'success',
  CANCELLED:        'danger',
  NO_SHOW:          'danger',
};

const TRIP_LABEL: Record<TripStatus, string> = {
  SCHEDULED:        'Scheduled',
  DRIVER_ASSIGNED:  'Assigned',
  PRE_TRIP:         'Heading Out',
  ON_THE_WAY:       'En Route',
  ARRIVED_PICKUP:   'At Pickup',
  PICKED_UP:        'Picked Up',
  EN_ROUTE_DROPOFF: 'To Drop-off',
  ARRIVED_DROPOFF:  'At Drop-off',
  COMPLETED:        'Completed',
  CANCELLED:        'Cancelled',
  NO_SHOW:          'No Show',
};

function fmtTime(t: string | null) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-SA', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverDashboardPage() {
  const router = useRouter();
  const [trips, setTrips]   = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    // Client-side role guard — middleware already enforces server-side
    fetch('/api/me')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.role === 'ADMIN')  { router.replace('/admin'); return; }
        if (data?.role === 'PARENT') { router.replace('/dashboard'); return; }
        // role === 'DRIVER' — load trips
      })
      .catch(() => {});

    tripService.list('upcoming')
      .then((res) => {
        if (res.data) {
          setTrips(Array.isArray(res.data) ? res.data : []);
        } else {
          setError(res.error?.message ?? 'Failed to load trips.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to connect.');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived stats
  const today = new Date().toISOString().split('T')[0]!;
  const todayTrips = trips.filter((t) => t.scheduledDate.startsWith(today));
  const activeTrip = trips.find((t) =>
    ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(t.status),
  );
  const nextTrip = trips.find(
    (t) => t.status === 'SCHEDULED' || t.status === 'DRIVER_ASSIGNED',
  );
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const upcomingCount  = trips.filter((t) => t.status === 'SCHEDULED' || t.status === 'DRIVER_ASSIGNED').length;

  return (
    <AppShell>
      <PageHeader
        title="Driver Dashboard"
        subtitle="Your assignments and schedule for today"
      />

      {loading ? (
        <LoadingState message="Loading your dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-6">

          {/* ── Stat cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Today's Trips"
              value={todayTrips.length}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              color="#0B683A"
            />
            <StatCard
              label="Active Now"
              value={activeTrip ? 1 : 0}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
              color={activeTrip ? '#14A34A' : '#6B7280'}
            />
            <StatCard
              label="Completed Today"
              value={completedToday}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              }
              color="#1D4ED8"
            />
            <StatCard
              label="Upcoming"
              value={upcomingCount}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3 M12 21a4 4 0 0 0 4-4v-1h1a4 4 0 0 0 0-8h-7a4 4 0 0 0-4 4" />
                </svg>
              }
              color="#7C3AED"
            />
          </div>

          {/* ── Active trip banner ─────────────────────────────────────── */}
          {activeTrip && (
            <Card className="border-2 border-fizza-secondary/40 bg-emerald-50/30">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Active Trip</span>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {activeTrip.rider?.name ?? 'Rider'}
                  </h2>
                  {activeTrip.rider?.school && (
                    <p className="text-xs text-gray-500">{activeTrip.rider.school}</p>
                  )}
                </div>
                <StatusBadge variant={TRIP_VARIANT[activeTrip.status]}>
                  {TRIP_LABEL[activeTrip.status]}
                </StatusBadge>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Pickup</p>
                  <p className="font-medium text-gray-800">{fmtTime(activeTrip.scheduledPickupTime)}</p>
                  <p className="text-xs text-gray-500 truncate">{activeTrip.pickupLocation}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Dropoff</p>
                  <p className="font-medium text-gray-800">{fmtTime(activeTrip.scheduledDropoffTime)}</p>
                  <p className="text-xs text-gray-500 truncate">{activeTrip.dropoffLocation}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/tracking/${activeTrip.id}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="primary" size="sm">
                    Open GPS Tracking
                  </Button>
                </a>
                <a href="/trips">
                  <Button variant="outline" size="sm">Trip Details</Button>
                </a>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-3 gap-5">

            {/* ── Next trip / Schedule ───────────────────────────────── */}
            <div className="lg:col-span-2">
              <Card>
                <div className="section-header">
                  <h2 className="text-base font-semibold text-gray-900">
                    {nextTrip ? 'Next Trip' : 'Upcoming Schedule'}
                  </h2>
                  <a href="/trips" className="text-sm text-fizza-secondary hover:text-fizza-primary font-medium transition-colors">
                    View all →
                  </a>
                </div>

                {trips.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-3 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <ClipboardList className="h-6 w-6 text-gray-400" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">No trips assigned yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        The admin assigns trips based on your vehicle and service area.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {trips.map((trip) => (
                      <div key={trip.id} className="flex items-center gap-3 py-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-sm font-bold text-fizza-primary shrink-0">
                          {trip.rider?.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {trip.rider?.name ?? 'Unknown rider'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {fmtDate(trip.scheduledDate)} · {fmtTime(trip.scheduledPickupTime)}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{trip.pickupLocation}</p>
                        </div>
                        <StatusBadge variant={TRIP_VARIANT[trip.status]}>
                          {TRIP_LABEL[trip.status]}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Quick actions ──────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <Card>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {([
                    { href: '/trips', Icon: ClipboardList, title: 'My Trips', sub: `${upcomingCount} upcoming`, bg: 'bg-emerald-50 text-fizza-secondary' },
                    { href: '/tracking', Icon: MapPin, title: 'GPS Tracking', sub: 'Share live location', bg: 'bg-blue-50 text-blue-600' },
                    { href: '/safety', Icon: Shield, title: 'Safety Report', sub: 'Report an incident', bg: 'bg-red-50 text-red-500' },
                    { href: '/notifications', Icon: Bell, title: 'Notifications', sub: 'View updates', bg: 'bg-amber-50 text-amber-600' },
                    { href: '/profile', Icon: UserRound, title: 'My Profile', sub: 'Account settings', bg: 'bg-gray-100 text-gray-600' },
                  ] as { href: string; Icon: LucideIcon; title: string; sub: string; bg: string }[]).map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
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

              {/* GPS guidance card */}
              <Card className="bg-blue-50/50 border-blue-100">
                <div className="flex items-start gap-3">
                  <MapPin className="h-8 w-8 text-blue-600 shrink-0" strokeWidth={1.75} aria-hidden />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">GPS Sharing</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Enable location sharing during active trips so families can track their
                      child&apos;s ride in real time.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Find it in Quick Actions above.</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
