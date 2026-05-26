'use client';

import { useEffect, useMemo, useState } from 'react';
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
  buildDriverTripsListParams,
  computeDriverTripCounts,
  filterDriverAssignedTrips,
  filterTripsForLocalDate,
  fmtDriverDateTimeLabel,
  formatCountdown,
  getDriverStatusActionLabel,
  getTimezoneDateKey,
  isDriverActiveTrip,
  isWithinTrackingWindow,
  minutesUntilPickup,
  pickNextDriverTrip,
  sortTripsByStartAsc,
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
  driverId?: string | null;
  rider: { name: string; school: string | null } | null;
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.role === 'ADMIN') router.replace('/admin');
        else if (data?.role === 'PARENT') router.replace('/dashboard');
      })
      .catch(() => {});

    const params = buildDriverTripsListParams('week', 1, 100);
    tripService.list(params).then((res) => {
      if (res.data) setTrips(Array.isArray(res.data) ? res.data : []);
      else setError(res.error?.message ?? 'Failed to load trips.');
      setLoading(false);
    }).catch(() => {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = getTimezoneDateKey(now);
  const assignedTrips = useMemo(() => filterDriverAssignedTrips(trips), [trips]);
  const counts = useMemo(
    () => computeDriverTripCounts(assignedTrips, nowMs, now),
    [assignedTrips, nowMs, now],
  );
  const todayTrips = useMemo(
    () => sortTripsByStartAsc(filterTripsForLocalDate(assignedTrips, todayKey)),
    [assignedTrips, todayKey],
  );
  const heroTrip = useMemo(
    () => pickNextDriverTrip(assignedTrips, nowMs),
    [assignedTrips, nowMs],
  );
  const activeTrip = useMemo(
    () => assignedTrips.find((t) => isDriverActiveTrip(t)) ?? null,
    [assignedTrips],
  );
  const minsNext = heroTrip ? minutesUntilPickup(heroTrip.scheduledPickupTime, nowMs) : null;
  const countdown = formatCountdown(minsNext);

  const primaryCta = activeTrip
    ? { label: getDriverStatusActionLabel(activeTrip.status), href: `/tracking/${activeTrip.id}` }
    : heroTrip && isWithinTrackingWindow(heroTrip.scheduledPickupTime, nowMs)
    ? { label: 'Start GPS', href: `/tracking/${heroTrip.id}` }
    : heroTrip
    ? { label: 'Navigate to pickup', href: '/trips' }
    : { label: 'Open route sheet', href: '/trips' };

  const previewTrips = todayTrips.slice(0, 4);
  const dateLabel = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

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
                time={fmtDriverDateTimeLabel(heroTrip, now)}
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
                title="No upcoming assigned trips"
                description="Your next assigned trip will appear here once scheduled."
                action={<Link href="/trips"><Button variant="primary" size="sm">View route sheet</Button></Link>}
              />
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <DriverKpiCard icon={Calendar} value={counts.todayTotal} label="Today's trips" accent="#0B683A" />
              <DriverKpiCard icon={Clock} value={counts.active} label="Active now" accent={counts.active ? '#14A34A' : '#6B7280'} />
              <DriverKpiCard icon={CheckCircle2} value={counts.completedToday} label="Completed" accent="#1D4ED8" />
              <DriverKpiCard icon={ClipboardList} value={counts.upcoming} label="Upcoming" accent="#7C3AED" />
            </div>

            {!activeTrip && minsNext != null && minsNext <= 20 && minsNext > 0 && heroTrip && (
              <DriverNotice
                variant="soon"
                title="Trip starts soon"
                message={`${heroTrip.rider?.name ?? 'Rider'} pickup at ${fmtDriverDateTimeLabel(heroTrip, now)}.`}
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
                      time={fmtDriverDateTimeLabel(trip, now)}
                      riderName={trip.rider?.name ?? 'Rider'}
                      riderMeta={trip.rider?.school ?? undefined}
                      pickup={trip.pickupLocation}
                      dropoff={trip.dropoffLocation}
                      legType={trip.legType ?? 'OUTBOUND'}
                      status={trip.status}
                      highlighted={isDriverActiveTrip(trip)}
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
                <DriverQuickActionCard href="/trips" Icon={ClipboardList} title="Route sheet" subtitle={`${counts.remainingToday} remaining today`} accent="bg-emerald-50 text-fizza-secondary" />
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
