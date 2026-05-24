'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  DriverActionHero,
  DriverCommandHeader,
  DriverEmptyState,
  DriverErrorState,
  DriverKpiCard,
  DriverLoadingState,
  DriverNotice,
  DriverQuickActionCard,
  DriverRouteCard,
  DriverSectionTitle,
  Bell,
  MapPin,
  Shield,
} from '@/components/driver/DriverUI';
import { Button } from '@/components/ui';
import { tripService } from '@/services/tripService';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { isTrackableStatus } from '@/lib/trips/tripLifecycle';
import {
  fmtDriverTime,
  formatCountdown,
  getDriverStatusActionLabel,
  isWithinTrackingWindow,
  minutesUntilPickup,
} from '@/lib/ui/driverPortal';
import { Calendar, CheckCircle2, ClipboardList, Clock, UserRound } from 'lucide-react';

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
  const heroTrip = activeTrip ?? todayTrips
    .filter((t) => UPCOMING.has(t.status) || ACTIVE.has(t.status))
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))[0];
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const upcomingCount = todayTrips.filter((t) => UPCOMING.has(t.status)).length;
  const minsNext = heroTrip ? minutesUntilPickup(heroTrip.scheduledPickupTime) : null;
  const countdown = formatCountdown(minsNext);

  const primaryCta = activeTrip
    ? { label: getDriverStatusActionLabel(activeTrip.status), href: `/tracking/${activeTrip.id}` }
    : heroTrip && isWithinTrackingWindow(heroTrip.scheduledPickupTime)
    ? { label: 'Start GPS', href: `/tracking/${heroTrip.id}` }
    : heroTrip
    ? { label: 'Navigate to pickup', href: '/trips' }
    : { label: 'Open route sheet', href: '/trips' };

  const previewTrips = [...todayTrips]
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))
    .slice(0, 4);

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto driver-portal pb-24 md:pb-6">
        <DriverCommandHeader
          title="Driver Dashboard"
          subtitle="Your command center for today's route"
          dateLabel={dateLabel}
          driverStatus="On duty"
          gpsIndicator={activeTrip && isTrackableStatus(activeTrip.status) ? 'idle' : 'off'}
        />

        {loading ? (
          <DriverLoadingState message="Loading your dashboard…" />
        ) : error ? (
          <DriverErrorState message={error} onRetry={() => window.location.reload()} />
        ) : (
          <div className="space-y-4">
            {heroTrip ? (
              <DriverActionHero
                riderName={heroTrip.rider?.name ?? 'Rider'}
                pickup={heroTrip.pickupLocation}
                dropoff={heroTrip.dropoffLocation}
                time={fmtDriverTime(heroTrip.scheduledPickupTime)}
                countdown={countdown}
                statusLabel={activeTrip ? 'Active trip' : 'Next trip'}
                primaryAction={primaryCta.label}
                onPrimaryAction={() => { window.location.href = primaryCta.href; }}
                gpsStatus={activeTrip && isTrackableStatus(activeTrip.status) ? 'idle' : 'unavailable'}
                secondaryActions={
                  <>
                    <Link href="/trips"><Button variant="outline" size="sm">Route sheet</Button></Link>
                    {!activeTrip && heroTrip && (
                      <Link href={`/tracking/${heroTrip.id}`}><Button variant="ghost" size="sm">Live map</Button></Link>
                    )}
                  </>
                }
              />
            ) : (
              <DriverEmptyState
                title="No trips today"
                description="Your route will appear here once trips are assigned."
                action={<Link href="/trips"><Button variant="primary" size="sm">View route sheet</Button></Link>}
              />
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <DriverKpiCard icon={Calendar} value={todayTrips.length} label="Today's trips" accent="#0B683A" />
              <DriverKpiCard icon={Clock} value={activeTrip ? 1 : 0} label="Active now" accent={activeTrip ? '#14A34A' : '#6B7280'} />
              <DriverKpiCard icon={CheckCircle2} value={completedToday} label="Completed" accent="#1D4ED8" />
              <DriverKpiCard icon={ClipboardList} value={upcomingCount} label="Upcoming" accent="#7C3AED" />
            </div>

            {!activeTrip && minsNext != null && minsNext <= 20 && minsNext > 0 && heroTrip && (
              <DriverNotice
                variant="soon"
                title="Trip starts soon"
                message={`${heroTrip.rider?.name ?? 'Rider'} pickup at ${fmtDriverTime(heroTrip.scheduledPickupTime)}.`}
                action={<Link href="/trips"><Button variant="outline" size="sm">Prepare</Button></Link>}
              />
            )}
            {activeTrip && isTrackableStatus(activeTrip.status) && (
              <DriverNotice
                variant="gps"
                title="Start GPS sharing"
                message="Families can follow the ride once you share live location."
                action={<Link href={`/tracking/${activeTrip.id}`}><Button variant="primary" size="sm">Open Live GPS</Button></Link>}
              />
            )}

            <div>
              <DriverSectionTitle
                title="Today's schedule"
                action={<Link href="/trips" className="text-xs font-semibold text-fizza-secondary hover:underline">View all</Link>}
              />
              {previewTrips.length === 0 ? null : (
                <div className="space-y-2">
                  {previewTrips.map((trip) => (
                    <DriverRouteCard
                      key={trip.id}
                      time={fmtDriverTime(trip.scheduledPickupTime)}
                      riderName={trip.rider?.name ?? 'Rider'}
                      riderMeta={trip.rider?.school ?? undefined}
                      pickup={trip.pickupLocation}
                      dropoff={trip.dropoffLocation}
                      legType={trip.legType ?? 'OUTBOUND'}
                      status={trip.status}
                      highlighted={ACTIVE.has(trip.status)}
                      secondaryActions={
                        <Link href={`/tracking/${trip.id}`}><Button variant="ghost" size="sm">Details</Button></Link>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <DriverSectionTitle title="Quick actions" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <DriverQuickActionCard href="/trips" Icon={ClipboardList} title="Route sheet" subtitle={`${upcomingCount} upcoming today`} accent="bg-emerald-50 text-fizza-secondary" />
                <DriverQuickActionCard href="/tracking" Icon={MapPin} title="Live GPS" subtitle="Share location" accent="bg-blue-50 text-blue-600" />
                <DriverQuickActionCard href="/safety" Icon={Shield} title="Safety Center" subtitle="Report an incident" accent="bg-red-50 text-red-600" />
                <DriverQuickActionCard href="/notifications" Icon={Bell} title="Notifications" subtitle="Dispatch updates" accent="bg-amber-50 text-amber-600" />
                <DriverQuickActionCard href="/profile" Icon={UserRound} title="Profile" subtitle="Account settings" accent="bg-gray-100 text-gray-600" />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
