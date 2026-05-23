'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  Alert,
  Button,
  StatusBadge,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import { trackingService } from '@/services/trackingService';

// ─── Types ────────────────────────────────────────────────────────────────────

type TripStatus = 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'ON_THE_WAY' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

type TrackingData = {
  trip: {
    id: string;
    status: TripStatus;
    scheduledDate: string;
    scheduledPickupTime: string | null;
    scheduledDropoffTime: string | null;
    actualPickupTime: string | null;
    actualDropoffTime: string | null;
    pickupLocation: string;
    dropoffLocation: string;
    rider: { id: string; name: string; relationship: string; school: string | null } | null;
    driver: {
      id: string;
      rating: string | null;
      profile: { fullName: string; phone: string | null; avatarUrl: string | null } | null;
    } | null;
    vehicle: { model: string; plateNumber: string; color: string | null } | null;
  };
  currentLocation: { lat: number; lng: number; recordedAt: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STEPS: { status: TripStatus; label: string; emoji: string }[] = [
  { status: 'SCHEDULED',       label: 'Trip Scheduled',  emoji: '📅' },
  { status: 'DRIVER_ASSIGNED', label: 'Driver Assigned', emoji: '🚗' },
  { status: 'ON_THE_WAY',      label: 'Driver En Route', emoji: '🛣️' },
  { status: 'PICKED_UP',       label: 'Rider Picked Up', emoji: '👤' },
  { status: 'COMPLETED',       label: 'Trip Completed',  emoji: '✅' },
];

const STATUS_ORDER: Record<TripStatus, number> = {
  SCHEDULED: 0, DRIVER_ASSIGNED: 1, ON_THE_WAY: 2, PICKED_UP: 3, COMPLETED: 4, CANCELLED: -1,
};

const STATUS_BADGE_VARIANT: Record<TripStatus, 'warning' | 'info' | 'purple' | 'orange' | 'success' | 'danger'> = {
  SCHEDULED:       'warning',
  DRIVER_ASSIGNED: 'info',
  ON_THE_WAY:      'purple',
  PICKED_UP:       'orange',
  COMPLETED:       'success',
  CANCELLED:       'danger',
};

const STATUS_LABEL: Record<TripStatus, string> = {
  SCHEDULED: 'Scheduled', DRIVER_ASSIGNED: 'Driver Assigned', ON_THE_WAY: 'On the Way',
  PICKED_UP: 'Picked Up', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(dt: string): string {
  return new Date(dt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Map components ───────────────────────────────────────────────────────────

function MapFallback({
  pickup, dropoff, currentLocation, status,
}: {
  pickup: string; dropoff: string;
  currentLocation: { lat: number; lng: number; recordedAt: string } | null;
  status: TripStatus;
}) {
  const hasLive = currentLocation && ['ON_THE_WAY', 'PICKED_UP'].includes(status);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
      <div className="px-5 py-3 bg-black/30 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Route Overview</span>
        {hasLive ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        ) : (
          <span className="text-xs text-slate-500">Not live yet</span>
        )}
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 text-sm font-bold">A</div>
            <div className="w-0.5 h-8 bg-slate-600" />
          </div>
          <div className="pt-1">
            <p className="text-xs text-slate-400 mb-0.5">Pickup</p>
            <p className="text-sm font-medium leading-tight">{pickup}</p>
          </div>
        </div>

        {hasLive && (
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center text-base">🚗</div>
              <div className="w-0.5 h-8 bg-slate-600" />
            </div>
            <div className="pt-1">
              <p className="text-xs text-slate-400 mb-0.5">
                Driver · updated {fmtTime(currentLocation!.recordedAt)}
              </p>
              <p className="text-xs text-slate-300 font-mono">
                {currentLocation!.lat.toFixed(5)}, {currentLocation!.lng.toFixed(5)}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center text-red-300 text-sm font-bold">B</div>
          <div className="pt-1">
            <p className="text-xs text-slate-400 mb-0.5">Dropoff</p>
            <p className="text-sm font-medium leading-tight">{dropoff}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-black/20 text-xs text-slate-500 text-center">
        Set NEXT_PUBLIC_MAPBOX_TOKEN for an interactive map
      </div>
    </div>
  );
}

function MapboxMap({
  token, pickup, dropoff, currentLocation,
}: {
  token: string; pickup: string; dropoff: string;
  currentLocation: { lat: number; lng: number } | null;
}) {
  const width = 700;
  const height = 320;
  const overlay = currentLocation
    ? `pin-s-car+1da462(${currentLocation.lng},${currentLocation.lat})/`
    : '';
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}auto/${width}x${height}?access_token=${token}&attribution=false&logo=false`;

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Route map" width={width} height={height} className="w-full object-cover" />
      <div className="px-4 py-2 bg-gray-50 flex justify-between text-xs text-gray-500">
        <span>A: {pickup}</span>
        <span>B: {dropoff}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;

  const [data, setData]           = useState<TrackingData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState('');
  const [lastPoll, setLastPoll]   = useState<Date | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

  useEffect(() => {
    if (!tripId) return;

    const fetch = () => {
      trackingService.get(tripId).then((res) => {
        if (res.data) { setData(res.data); setLastPoll(new Date()); }
        else if (!data) setPageError(res.error?.message ?? 'Failed to load tracking data.');
        setLoading(false);
      });
    };

    fetch();
    const interval = setInterval(fetch, 20_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  if (loading) return <AppShell><LoadingState message="Loading tracking info…" /></AppShell>;

  if (pageError || !data) {
    return (
      <AppShell>
        <Link href="/trips" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          My Trips
        </Link>
        <ErrorState message={pageError || 'Trip not found.'} />
      </AppShell>
    );
  }

  const { trip, currentLocation } = data;
  const currentOrder = STATUS_ORDER[trip.status] ?? -1;
  const isCancelled  = trip.status === 'CANCELLED';
  const isLive       = ['ON_THE_WAY', 'PICKED_UP'].includes(trip.status);

  return (
    <AppShell>
      {/* Back link */}
      <Link href="/trips" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        My Trips
      </Link>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(trip.scheduledDate).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge variant={STATUS_BADGE_VARIANT[trip.status]}>
            {STATUS_LABEL[trip.status]}
          </StatusBadge>
          {isLive && lastPoll && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Polling · {fmtTime(lastPoll.toISOString())}
            </span>
          )}
        </div>
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <Alert variant="error" className="mb-5">This trip has been cancelled.</Alert>
      )}

      {/* Map */}
      <div className="mb-5">
        {mapboxToken ? (
          <MapboxMap
            token={mapboxToken}
            pickup={trip.pickupLocation}
            dropoff={trip.dropoffLocation}
            currentLocation={currentLocation}
          />
        ) : (
          <MapFallback
            pickup={trip.pickupLocation}
            dropoff={trip.dropoffLocation}
            currentLocation={currentLocation}
            status={trip.status}
          />
        )}
      </div>

      {/* Driver + Vehicle */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        {trip.driver ? (
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Driver</p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-base shrink-0">
                {trip.driver.profile?.fullName?.[0] ?? 'D'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{trip.driver.profile?.fullName ?? 'Driver'}</p>
                {trip.driver.rating && (
                  <p className="text-sm text-amber-600 font-medium">★ {Number(trip.driver.rating).toFixed(1)}</p>
                )}
                {trip.driver.profile?.phone && (
                  <p className="text-xs text-gray-400 mt-0.5">{trip.driver.profile.phone}</p>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Driver</p>
            <p className="text-sm text-gray-400">No driver assigned yet.</p>
          </Card>
        )}

        {trip.vehicle ? (
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle</p>
            <p className="font-semibold text-gray-900">{trip.vehicle.model}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {trip.vehicle.color ? `${trip.vehicle.color} · ` : ''}
              <span className="font-mono font-medium">{trip.vehicle.plateNumber}</span>
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle</p>
            <p className="text-sm text-gray-400">No vehicle info yet.</p>
          </Card>
        )}
      </div>

      {/* Trip details */}
      <Card className="mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Trip Details</h2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-700">
          {trip.rider && (
            <div className="flex gap-1.5">
              <span className="text-gray-400 shrink-0">Rider</span>
              <span>{trip.rider.name} <span className="text-gray-400">({trip.rider.relationship})</span></span>
            </div>
          )}
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Sched. pickup</span>
            <span>{fmtTime(trip.scheduledPickupTime)}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Sched. dropoff</span>
            <span>{fmtTime(trip.scheduledDropoffTime)}</span>
          </div>
          {trip.actualPickupTime && (
            <div className="flex gap-1.5">
              <span className="text-gray-400 shrink-0">Actual pickup</span>
              <span className="text-emerald-700 font-medium">{fmtTime(trip.actualPickupTime)}</span>
            </div>
          )}
          {trip.actualDropoffTime && (
            <div className="flex gap-1.5">
              <span className="text-gray-400 shrink-0">Actual dropoff</span>
              <span className="text-emerald-700 font-medium">{fmtTime(trip.actualDropoffTime)}</span>
            </div>
          )}
          <div className="sm:col-span-2 flex gap-1.5">
            <span className="text-gray-400 shrink-0">From</span>
            <span>{trip.pickupLocation}</span>
          </div>
          <div className="sm:col-span-2 flex gap-1.5">
            <span className="text-gray-400 shrink-0">To</span>
            <span>{trip.dropoffLocation}</span>
          </div>
        </div>
      </Card>

      {/* Status timeline */}
      {!isCancelled && (
        <Card className="mb-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Trip Progress</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, idx) => {
              const stepOrder = STATUS_ORDER[step.status];
              const done      = currentOrder >= stepOrder;
              const active    = currentOrder === stepOrder;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  {/* Step indicator */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm transition-colors ${
                    done
                      ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                      : 'bg-gray-100 text-gray-300 border-2 border-gray-200'
                  }`}>
                    {done ? step.emoji : <span className="text-xs font-semibold">{idx + 1}</span>}
                  </div>

                  {/* Label */}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-300'}`}>
                      {step.label}
                    </p>
                    {active && currentLocation && step.status === 'ON_THE_WAY' && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Last GPS update: {fmtDateTime(currentLocation.recordedAt)}
                      </p>
                    )}
                  </div>

                  {/* "Now" pill */}
                  {active && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Now
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Button variant="outline" size="sm" disabled title="Coming soon" className="justify-center py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 9.81a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 17z" />
          </svg>
          Contact Driver
        </Button>
        <Button variant="outline" size="sm" disabled title="Coming soon" className="justify-center py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Report Issue
        </Button>
      </div>
    </AppShell>
  );
}
