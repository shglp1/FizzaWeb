'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { trackingService } from '@/services/trackingService';

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

const STATUS_STEPS: { status: TripStatus; label: string; icon: string }[] = [
  { status: 'SCHEDULED',       label: 'Trip Scheduled',   icon: '📅' },
  { status: 'DRIVER_ASSIGNED', label: 'Driver Assigned',  icon: '🚗' },
  { status: 'ON_THE_WAY',      label: 'Driver En Route',  icon: '🛣️' },
  { status: 'PICKED_UP',       label: 'Rider Picked Up',  icon: '👤' },
  { status: 'COMPLETED',       label: 'Trip Completed',   icon: '✅' },
];

const STATUS_ORDER: Record<TripStatus, number> = {
  SCHEDULED: 0,
  DRIVER_ASSIGNED: 1,
  ON_THE_WAY: 2,
  PICKED_UP: 3,
  COMPLETED: 4,
  CANCELLED: -1,
};

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(dt: string): string {
  return new Date(dt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function MapFallback({
  pickup,
  dropoff,
  currentLocation,
  status,
}: {
  pickup: string;
  dropoff: string;
  currentLocation: { lat: number; lng: number; recordedAt: string } | null;
  status: TripStatus;
}) {
  const hasLive = currentLocation && ['ON_THE_WAY', 'PICKED_UP'].includes(status);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
      {/* Header bar */}
      <div className="px-5 py-3 bg-black/30 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Route Overview</span>
        {hasLive && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Route visualisation */}
      <div className="px-5 py-5 space-y-4">
        {/* Pickup */}
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

        {/* Current driver position (live only) */}
        {hasLive && (
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center text-blue-300 text-sm">🚗</div>
              <div className="w-0.5 h-8 bg-slate-600" />
            </div>
            <div className="pt-1">
              <p className="text-xs text-slate-400 mb-0.5">
                Driver location
                <span className="ml-2 text-slate-500">· updated {fmtTime(currentLocation!.recordedAt)}</span>
              </p>
              <p className="text-xs text-slate-300 font-mono">
                {currentLocation!.lat.toFixed(5)}, {currentLocation!.lng.toFixed(5)}
              </p>
            </div>
          </div>
        )}

        {/* Dropoff */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center text-red-300 text-sm font-bold">B</div>
          <div className="pt-1">
            <p className="text-xs text-slate-400 mb-0.5">Dropoff</p>
            <p className="text-sm font-medium leading-tight">{dropoff}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-black/20 text-xs text-slate-500 text-center">
        Enable NEXT_PUBLIC_MAPBOX_TOKEN for interactive map
      </div>
    </div>
  );
}

function MapboxMap({
  token,
  pickup,
  dropoff,
  currentLocation,
}: {
  token: string;
  pickup: string;
  dropoff: string;
  currentLocation: { lat: number; lng: number } | null;
}) {
  // Encode pickup/dropoff as pin labels — Mapbox Static Images approach
  // Without geocoding we can only show driver pin if we have coordinates
  const width = 700;
  const height = 320;
  let overlay = '';
  if (currentLocation) {
    overlay = `pin-s-car+1da462(${currentLocation.lng},${currentLocation.lat})/`;
  }
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

export default function TrackingPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

  useEffect(() => {
    if (!tripId) return;
    trackingService.get(tripId).then((res) => {
      if (res.data) setData(res.data);
      else setPageError(res.error?.message ?? 'Failed to load tracking data.');
      setLoading(false);
    });

    // Poll every 20 s while trip is active
    const interval = setInterval(() => {
      trackingService.get(tripId).then((res) => {
        if (res.data) setData(res.data);
      });
    }, 20_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading tracking info…</div>
      </AppShell>
    );
  }

  if (pageError || !data) {
    return (
      <AppShell>
        <div className="card text-red-600 text-sm">{pageError || 'Trip not found.'}</div>
        <Link href="/trips" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">← Back to Trips</Link>
      </AppShell>
    );
  }

  const { trip, currentLocation } = data;
  const currentOrder = STATUS_ORDER[trip.status] ?? -1;
  const isCancelled = trip.status === 'CANCELLED';

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/trips" className="text-sm text-gray-500 hover:text-gray-700">← My Trips</Link>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Live Tracking</h1>
      <p className="text-sm text-gray-500 mb-6">
        {new Date(trip.scheduledDate).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
        })}
      </p>

      {/* Map or fallback */}
      <div className="mb-6">
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

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Driver card */}
        {trip.driver ? (
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg shrink-0">
              {trip.driver.profile?.fullName?.[0] ?? 'D'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{trip.driver.profile?.fullName ?? 'Driver'}</p>
              {trip.driver.rating && (
                <p className="text-sm text-amber-600">★ {Number(trip.driver.rating).toFixed(1)}</p>
              )}
              {trip.driver.profile?.phone && (
                <p className="text-xs text-gray-400 mt-0.5">{trip.driver.profile.phone}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card text-sm text-gray-400">No driver assigned yet.</div>
        )}

        {/* Vehicle card */}
        {trip.vehicle ? (
          <div className="card">
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Vehicle</p>
            <p className="font-semibold">{trip.vehicle.model}</p>
            <p className="text-sm text-gray-500">
              {trip.vehicle.color ? `${trip.vehicle.color} · ` : ''}
              <span className="font-mono">{trip.vehicle.plateNumber}</span>
            </p>
          </div>
        ) : (
          <div className="card text-sm text-gray-400">No vehicle info yet.</div>
        )}
      </div>

      {/* Trip details */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Trip Details</h2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-700">
          {trip.rider && (
            <p><span className="text-gray-400">Rider:</span> {trip.rider.name} ({trip.rider.relationship})</p>
          )}
          <p><span className="text-gray-400">Scheduled pickup:</span> {fmtTime(trip.scheduledPickupTime)}</p>
          <p><span className="text-gray-400">Scheduled dropoff:</span> {fmtTime(trip.scheduledDropoffTime)}</p>
          {trip.actualPickupTime && (
            <p><span className="text-gray-400">Actual pickup:</span> {fmtTime(trip.actualPickupTime)}</p>
          )}
          {trip.actualDropoffTime && (
            <p><span className="text-gray-400">Actual dropoff:</span> {fmtTime(trip.actualDropoffTime)}</p>
          )}
          <p className="sm:col-span-2">
            <span className="text-gray-400">Pickup:</span> {trip.pickupLocation}
          </p>
          <p className="sm:col-span-2">
            <span className="text-gray-400">Dropoff:</span> {trip.dropoffLocation}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Trip Progress</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, idx) => {
              const stepOrder = STATUS_ORDER[step.status];
              const done = currentOrder >= stepOrder;
              const current = currentOrder === stepOrder;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-300'
                  }`}>
                    {done ? step.icon : <span className="text-xs font-semibold text-gray-400">{idx + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-300'}`}>
                      {step.label}
                    </p>
                    {current && currentLocation && step.status === 'ON_THE_WAY' && (
                      <p className="text-xs text-emerald-600">
                        Last update: {fmtDateTime(currentLocation.recordedAt)}
                      </p>
                    )}
                  </div>
                  {current && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Now
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="card mb-6 border border-red-200 bg-red-50">
          <p className="text-red-700 font-semibold text-sm">This trip has been cancelled.</p>
        </div>
      )}

      {/* Action placeholders */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          disabled
          className="btn-outline text-sm py-3 opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          📞 Contact Driver
        </button>
        <button
          disabled
          className="btn-outline text-sm py-3 opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          ⚠️ Report Issue
        </button>
      </div>
    </AppShell>
  );
}
