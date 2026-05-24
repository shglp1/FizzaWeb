'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  DriverAlert,
  DriverEmptyState,
  DriverErrorState,
  DriverHeroCard,
  DriverLoadingState,
  DriverPageHeader,
  DriverQuickAction,
  DriverStatGrid,
  DriverTripCard,
  Bell,
  MapPin,
  Shield,
} from '@/components/driver/DriverUI';
import { Button, Card } from '@/components/ui';
import { tripService } from '@/services/tripService';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { isActiveStatus, isTrackableStatus } from '@/lib/trips/tripLifecycle';
import {
  fmtDriverTime,
  getDriverPrimaryAction,
  getDriverStatusActionLabel,
  isWithinTrackingWindow,
  minutesUntilPickup,
} from '@/lib/ui/driverPortal';
import { ClipboardList, UserRound } from 'lucide-react';

type Trip = {
  id: string;
  status: TripStatus;
  legType: 'OUTBOUND' | 'RETURN';
  scheduledDate: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { name: string; school: string | null } | null;
};

const ACTIVE = new Set(['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF']);
const UPCOMING = new Set(['SCHEDULED', 'DRIVER_ASSIGNED']);

export default function DriverDashboardPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.role === 'ADMIN') router.replace('/admin');
        else if (data?.role === 'PARENT') router.replace('/dashboard');
      })
      .catch(() => {});

    tripService.list('upcoming').then((res) => {
      if (res.data) setTrips(Array.isArray(res.data) ? res.data : []);
      else setError(res.error?.message ?? 'Failed to load trips.');
      setLoading(false);
    }).catch(() => {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    });
  }, [router]);

  const today = new Date().toISOString().split('T')[0]!;
  const todayTrips = trips.filter((t) => t.scheduledDate.startsWith(today));
  const activeTrip = trips.find((t) => ACTIVE.has(t.status));
  const nextTrip = todayTrips
    .filter((t) => UPCOMING.has(t.status) || ACTIVE.has(t.status))
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))[0];
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const upcomingCount = todayTrips.filter((t) => UPCOMING.has(t.status)).length;

  const nextAction = activeTrip
    ? getDriverStatusActionLabel(activeTrip.status)
    : nextTrip
    ? getDriverPrimaryAction(nextTrip.status, isWithinTrackingWindow(nextTrip.scheduledPickupTime)).label
    : 'Review your schedule';

  const warnings: string[] = [];
  const minsNext = nextTrip ? minutesUntilPickup(nextTrip.scheduledPickupTime) : null;
  if (minsNext != null && minsNext > 0 && minsNext <= 30 && !activeTrip) {
    warnings.push(`Next trip starts in ~${minsNext} minutes.`);
  }
  if (activeTrip && isTrackableStatus(activeTrip.status)) {
    warnings.push('Remember to start GPS sharing when en route.');
  }

  const attentionAlerts: { variant: 'gps' | 'soon' | 'late'; title: string; message: string; href?: string }[] = [];
  if (!activeTrip && nextTrip && minsNext != null && minsNext <= 15) {
    attentionAlerts.push({
      variant: 'soon',
      title: 'Trip starts soon',
      message: `${nextTrip.rider?.name ?? 'Rider'} pickup at ${fmtDriverTime(nextTrip.scheduledPickupTime)}.`,
      href: '/trips',
    });
  }
  if (activeTrip && isTrackableStatus(activeTrip.status)) {
    attentionAlerts.push({
      variant: 'gps',
      title: 'GPS sharing recommended',
      message: 'Families can follow the ride once you start sharing location.',
      href: `/tracking/${activeTrip.id}`,
    });
  }

  const previewTrips = [...todayTrips]
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))
    .slice(0, 5);

  return (
    <AppShell>
      <DriverPageHeader
        title="Driver Dashboard"
        subtitle="Your assignments and next actions for today"
      />

      {loading ? (
        <DriverLoadingState message="Loading your dashboard…" />
      ) : error ? (
        <DriverErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-5">
          <DriverHeroCard
            nextTripLabel={
              activeTrip
                ? `Active: ${activeTrip.rider?.name ?? 'Rider'}`
                : nextTrip
                ? `Next: ${nextTrip.rider?.name ?? 'Rider'} at ${fmtDriverTime(nextTrip.scheduledPickupTime)}`
                : 'No trips scheduled today'
            }
            nextAction={nextAction}
            gpsStatus={activeTrip && isTrackableStatus(activeTrip.status) ? 'idle' : 'unavailable'}
            warnings={warnings.length > 0 ? warnings : undefined}
          />

          <DriverStatGrid
            stats={[
              { label: "Today's trips", value: todayTrips.length },
              { label: 'Active now', value: activeTrip ? 1 : 0, accent: activeTrip ? '#14A34A' : '#6B7280' },
              { label: 'Completed today', value: completedToday, accent: '#1D4ED8' },
              { label: 'Upcoming', value: upcomingCount, accent: '#7C3AED' },
            ]}
          />

          {attentionAlerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">Needs attention</p>
              {attentionAlerts.map((a) => (
                <DriverAlert
                  key={a.title}
                  variant={a.variant}
                  title={a.title}
                  message={a.message}
                  action={a.href ? (
                    <a href={a.href}>
                      <Button variant="outline" size="sm">Open</Button>
                    </a>
                  ) : undefined}
                />
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Today&apos;s schedule</h2>
                <Link href="/trips" className="text-sm font-medium text-fizza-secondary hover:text-fizza-primary">
                  View full route sheet
                </Link>
              </div>

              {previewTrips.length === 0 ? (
                <DriverEmptyState
                  title="No trips today"
                  description="The admin assigns trips based on your vehicle and service area."
                  action={
                    <Link href="/trips">
                      <Button variant="outline" size="sm">Open route sheet</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {previewTrips.map((trip) => (
                    <DriverTripCard
                      key={trip.id}
                      time={fmtDriverTime(trip.scheduledPickupTime)}
                      riderName={trip.rider?.name ?? 'Rider'}
                      pickup={trip.pickupLocation}
                      dropoff={trip.dropoffLocation}
                      legType={trip.legType ?? 'OUTBOUND'}
                      status={trip.status}
                      secondaryActions={
                        <Link href={`/tracking/${trip.id}`}>
                          <Button variant="ghost" size="sm">Details</Button>
                        </Link>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <Card>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Quick actions</h2>
              <div className="space-y-1">
                <DriverQuickAction href="/trips" Icon={ClipboardList} title="My route sheet" subtitle={`${upcomingCount} upcoming today`} accent="bg-emerald-50 text-fizza-secondary" />
                <DriverQuickAction href="/tracking" Icon={MapPin} title="Start GPS tracking" subtitle="Share live location" accent="bg-blue-50 text-blue-600" />
                <DriverQuickAction href="/safety" Icon={Shield} title="Report safety issue" subtitle="Safety Center" accent="bg-red-50 text-red-500" />
                <DriverQuickAction href="/notifications" Icon={Bell} title="Notifications" subtitle="Dispatch & trip updates" accent="bg-amber-50 text-amber-600" />
                <DriverQuickAction href="/profile" Icon={UserRound} title="Profile" subtitle="Account settings" accent="bg-gray-100 text-gray-600" />
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
