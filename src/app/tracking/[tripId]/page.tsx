'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { DriverGpsPanel } from '@/components/DriverGpsPanel';
import {
  DriverActionBar,
  DriverBottomActionBar,
  DriverCommandHeader,
  DriverMapFallback,
  DriverMapPanel,
  DriverNotice,
  DriverRouteTimeline,
  DriverErrorState,
  DriverLoadingState,
  Navigation,
} from '@/components/driver/DriverUI';
import { TripTrackingMap } from '@/components/tracking/TripTrackingMap';
import {
  Card, StatusBadge, Button,
} from '@/components/ui';
import { trackingService } from '@/services/trackingService';
import { TRIP_STATUS_LABEL, isTrackableStatus } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { MapPin, XCircle, Info, CheckCircle2, CircleOff } from 'lucide-react';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';
import {
  getDriverPrimaryAction,
  getDriverStatusActionLabel,
  hasRouteCoordinates,
  hasRenderableMapPoints,
  isWithinTrackingWindow,
} from '@/lib/ui/driverPortal';
import { tripService } from '@/services/tripService';

type TripEvent = {
  id: string;
  eventType: string;
  message: string | null;
  actorRole: string;
  createdAt: string;
};

type TrackingTrip = {
  id: string;
  status: string;
  statusReason: string | null;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  rider: { id: string; name: string; relationship: string } | null;
  driver: {
    id: string;
    rating: number | string | null;
    profile: { fullName: string; phone: string; avatarUrl: string | null } | null;
  } | null;
  vehicle: { model: string; plateNumber: string; color: string } | null;
  events: TripEvent[];
};

type Location = {
  lat: number;
  lng: number;
  recordedAt: string;
  stale: boolean;
};

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'purple' | 'orange' | 'success' | 'danger'> = {
  DRIVER_ASSIGNED: 'info',
  PRE_TRIP: 'purple',
  ON_THE_WAY: 'purple',
  ARRIVED_PICKUP: 'orange',
  PICKED_UP: 'orange',
  EN_ROUTE_DROPOFF: 'purple',
  ARRIVED_DROPOFF: 'orange',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

function fmtTime(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function minutesUntil(dt: string | null): number | null {
  if (!dt) return null;
  return Math.round((new Date(dt).getTime() - Date.now()) / 60_000);
}

function toCoord(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLocation(raw: unknown): Location | null {
  if (!raw || typeof raw !== 'object') return null;
  const loc = raw as Record<string, unknown>;
  const lat = toCoord(loc.lat);
  const lng = toCoord(loc.lng);
  if (lat == null || lng == null) return null;
  return {
    lat,
    lng,
    recordedAt: String(loc.recordedAt ?? new Date().toISOString()),
    stale: Boolean(loc.stale),
  };
}

type LiveGpsMode = 'live' | 'waiting_driver' | 'waiting_window' | 'ended' | 'no_driver';

function resolveLiveGpsMode(input: {
  status: string;
  trackable: boolean;
  hasLocation: boolean;
  hasDriver: boolean;
  minutesToPickup: number | null;
  isDriverView: boolean;
}): LiveGpsMode {
  const { status, trackable, hasLocation, hasDriver, minutesToPickup, isDriverView } = input;
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return 'ended';
  if (!hasDriver && !isDriverView) return 'no_driver';
  if (hasLocation && trackable) return 'live';
  if (trackable) return 'waiting_driver';
  if (!isDriverView && minutesToPickup != null && minutesToPickup > 10) return 'waiting_window';
  return 'waiting_driver';
}

function LiveGpsGuide({
  mode,
  minutesToPickup,
  statusLabel,
  isDriver,
}: {
  mode: LiveGpsMode;
  minutesToPickup: number | null;
  statusLabel: string;
  isDriver: boolean;
}) {
  const driverSummary = mode === 'live'
    ? 'You are sharing live location. Families see updates about every 15 seconds.'
    : mode === 'waiting_driver'
    ? 'Start sharing location so families can follow the ride.'
    : mode === 'ended'
    ? `Trip is ${statusLabel.toLowerCase()}. GPS sharing has ended.`
    : 'Live GPS opens when the trip is active.';

  const parentSummary = mode === 'live'
    ? 'The driver is sharing location. The map refreshes about every 15 seconds.'
    : mode === 'waiting_window'
    ? minutesToPickup != null
      ? `Tracking opens about 10 minutes before pickup (in ~${minutesToPickup} min).`
      : 'Tracking opens about 10 minutes before scheduled pickup.'
    : mode === 'waiting_driver'
    ? 'The driver has not started sharing live GPS yet.'
    : mode === 'ended'
    ? `This trip is ${statusLabel.toLowerCase()}. Live tracking has ended.`
    : 'No driver is assigned yet.';

  const tone = mode === 'live' ? 'border-emerald-200 bg-emerald-50' :
    mode === 'ended' || mode === 'no_driver' ? 'border-gray-200 bg-gray-50' :
    'border-amber-200 bg-amber-50';

  return (
    <Card className={`mb-4 border ${tone}`}>
      <div className="flex items-start gap-3">
        {mode === 'live' ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
        ) : mode === 'ended' || mode === 'no_driver' ? (
          <CircleOff className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" aria-hidden />
        ) : (
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {mode === 'live' ? 'Live GPS active' : mode === 'waiting_window' ? 'Live GPS opens soon' : mode === 'ended' ? 'Live GPS ended' : 'Live GPS not available yet'}
          </p>
          <p className="text-sm text-gray-600 mt-1">{isDriver ? driverSummary : parentSummary}</p>
        </div>
      </div>
    </Card>
  );
}

export default function TrackingDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<TrackingTrip | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((res) => {
      if (res.data?.role) setUserRole(res.data.role);
    }).catch(() => {});
  }, []);

  const fetchTracking = useCallback(async () => {
    const res = await trackingService.get(tripId);
    if (res.data) {
      setTrip(res.data.trip as TrackingTrip);
      setLocation(normalizeLocation(res.data.location));
      setLastUpdated(new Date());
    } else {
      setPageError(res.error?.message ?? 'Failed to load tracking data.');
    }
    setLoading(false);
  }, [tripId]);

  const pollLocation = useCallback(async () => {
    const res = await trackingService.getLocation(tripId);
    const next = normalizeLocation(res.data?.location);
    if (next) {
      setLocation(next);
      setLastUpdated(new Date());
    }
  }, [tripId]);

  useEffect(() => { fetchTracking(); }, [fetchTracking]);

  useEffect(() => {
    if (!trip) return;
    const terminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(trip.status);
    if (terminal) return;
    pollLocation();
    pollRef.current = setInterval(pollLocation, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [trip, pollLocation]);

  const isDriver = userRole === 'DRIVER';

  if (loading) {
    return (
      <AppShell>
        <DriverLoadingState message="Loading trip tracking…" />
      </AppShell>
    );
  }

  if (pageError || !trip) {
    return (
      <AppShell>
        <DriverErrorState message={pageError || 'Trip not found.'} onRetry={fetchTracking} />
      </AppShell>
    );
  }

  const trackable = isTrackableStatus(trip.status as TripStatus);
  const minutesToPickup = minutesUntil(trip.scheduledPickupTime);
  const isCancelled = trip.status === 'CANCELLED' || trip.status === 'NO_SHOW';
  const pickupLat = toCoord(trip.pickupLat);
  const pickupLng = toCoord(trip.pickupLng);
  const dropoffLat = toCoord(trip.dropoffLat);
  const dropoffLng = toCoord(trip.dropoffLng);
  const routeMapsUrl = tripToGoogleMapsUrl({
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupLat, pickupLng, dropoffLat, dropoffLng,
  });
  const mapPoints = {
    driverLat: location?.lat,
    driverLng: location?.lng,
    pickupLat, pickupLng, dropoffLat, dropoffLng,
    stale: location?.stale,
  };
  const canRenderMap = hasRenderableMapPoints(mapPoints) || hasRouteCoordinates(trip);
  const liveGpsMode = resolveLiveGpsMode({
    status: trip.status,
    trackable,
    hasLocation: !!location,
    hasDriver: !!trip.driver,
    minutesToPickup,
    isDriverView: isDriver,
  });
  const statusLabel = TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status;
  const driverAction = isDriver
    ? getDriverPrimaryAction(trip.status as TripStatus, isWithinTrackingWindow(trip.scheduledPickupTime))
    : null;

  async function handleStatusAdvance() {
    if (!driverAction?.nextStatus) return;
    setStatusUpdating(true);
    await tripService.updateStatus(trip!.id, driverAction.nextStatus);
    setStatusUpdating(false);
    fetchTracking();
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto driver-portal pb-28 md:pb-6">
      <DriverCommandHeader
        title={isDriver ? `Live GPS — ${trip.rider?.name ?? 'Trip'}` : `Tracking — ${trip.rider?.name ?? 'Rider'}`}
        subtitle={new Date(trip.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        gpsIndicator={location && !location.stale ? 'active' : trackable && isDriver ? 'idle' : 'off'}
        action={
          <Link href="/tracking">
            <Button variant="ghost" size="sm">All trips</Button>
          </Link>
        }
      />

      <div className="mb-3">
        <StatusBadge variant={STATUS_VARIANT[trip.status] ?? 'info'} className="text-sm px-3 py-1.5">
          {statusLabel}
        </StatusBadge>
        {trip.statusReason && <p className="text-xs text-gray-500 mt-1">{trip.statusReason}</p>}
      </div>

      {location?.stale && (
        <DriverNotice variant="late" title="GPS signal delayed" message="Location shown may be up to 1 minute old." />
      )}

      {canRenderMap ? (
        <div className="mb-4">
          <DriverMapPanel
            loading={mapLoading}
            mapsUrl={routeMapsUrl}
            statusOverlay={
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-sm border border-gray-200">
                <span className={`h-2 w-2 rounded-full ${location && !location.stale ? 'bg-emerald-500 animate-pulse' : liveGpsMode === 'live' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {location && !location.stale ? 'GPS active' : liveGpsMode === 'waiting_window' ? 'GPS opens soon' : liveGpsMode === 'live' ? 'GPS active' : 'GPS unavailable'}
                {lastUpdated && location && (
                  <span className="text-gray-500 font-normal">· {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            }
            map={
              <TripTrackingMap
                {...mapPoints}
                height={320}
                className="sm:!min-h-[420px] sm:!h-[420px] rounded-none border-0"
                onReadyChange={(ready) => setMapLoading(!ready)}
              />
            }
          />
        </div>
      ) : (
        <div className="mb-4">
          <DriverMapFallback pickup={trip.pickupLocation} dropoff={trip.dropoffLocation} mapsUrl={routeMapsUrl} />
        </div>
      )}

      {!isDriver && <LiveGpsGuide mode={liveGpsMode} minutesToPickup={minutesToPickup} statusLabel={statusLabel} isDriver={isDriver} />}
      {isDriver && liveGpsMode !== 'live' && (
        <div className="mb-4">
          <DriverNotice
            variant={liveGpsMode === 'waiting_window' ? 'soon' : 'gps'}
            title={liveGpsMode === 'waiting_window' ? 'GPS opens soon' : 'Start sharing location'}
            message={liveGpsMode === 'waiting_window'
              ? `Tracking opens about 10 minutes before pickup${minutesToPickup != null ? ` (~${minutesToPickup} min)` : ''}.`
              : 'Tap Start sharing below so families can follow the ride.'}
          />
        </div>
      )}

      {isDriver && trackable && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-3">GPS sharing</p>
          <DriverGpsPanel tripId={trip.id} />
          {driverAction && driverAction.kind === 'status' && driverAction.nextStatus && (
            <div className="mt-4">
              <DriverActionBar>
                <Button variant="primary" size="sm" loading={statusUpdating} onClick={handleStatusAdvance} className="min-h-9">
                  {driverAction.label}
                </Button>
                <a href={routeMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><Navigation className="h-3.5 w-3.5" aria-hidden />Navigate</Button>
                </a>
                <Link href="/trips"><Button variant="ghost" size="sm">Route sheet</Button></Link>
              </DriverActionBar>
              {driverAction.disabledReason && <p className="text-xs text-amber-700 mt-2">{driverAction.disabledReason}</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Trip details</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-gray-400">Pickup</p>
                <p className="font-medium text-gray-800">{trip.pickupLocation}</p>
                <p className="text-xs text-gray-500">Scheduled: {fmtTime(trip.scheduledPickupTime)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-gray-400">Drop-off</p>
                <p className="font-medium text-gray-800">{trip.dropoffLocation}</p>
                <p className="text-xs text-gray-500">Scheduled: {fmtTime(trip.scheduledDropoffTime)}</p>
              </div>
            </div>
          </div>
        </Card>

        {!isDriver && trip.driver?.profile && (
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Driver</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-fizza-secondary/20 flex items-center justify-center text-lg font-bold text-fizza-primary">
                {trip.driver.profile.fullName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{trip.driver.profile.fullName}</p>
                {trip.driver.rating != null && !Number.isNaN(Number(trip.driver.rating)) && (
                  <p className="text-xs text-amber-500">Rating {Number(trip.driver.rating).toFixed(1)}</p>
                )}
              </div>
            </div>
            {trip.vehicle && (
              <div className="text-xs text-gray-500 space-y-0.5">
                <p>{trip.vehicle.color} {trip.vehicle.model}</p>
                <p className="font-mono tracking-wider">{trip.vehicle.plateNumber}</p>
              </div>
            )}
            {trip.driver.profile.phone && (
              <a href={`tel:${trip.driver.profile.phone}`} className="mt-3 inline-block text-xs text-fizza-secondary font-medium hover:underline">
                Call driver
              </a>
            )}
          </Card>
        )}

        {isDriver && (
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rider</p>
            <p className="font-semibold text-gray-900">{trip.rider?.name ?? 'Rider'}</p>
            <p className="text-xs text-gray-500 capitalize mt-1">{trip.rider?.relationship ?? 'Student'}</p>
            <p className="text-sm text-gray-600 mt-3">
              Next action: <span className="font-medium">{getDriverStatusActionLabel(trip.status as TripStatus)}</span>
            </p>
          </Card>
        )}
      </div>

      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Trip progress</p>
        {isCancelled ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
            <XCircle className="h-5 w-5 text-red-500" aria-hidden />
            <span>{statusLabel}</span>
          </div>
        ) : (
          <DriverRouteTimeline currentStatus={trip.status as TripStatus} />
        )}
      </Card>

      {isDriver && trackable && driverAction?.kind === 'status' && (
        <DriverBottomActionBar label="Trip actions" visible>
          <Button variant="primary" size="sm" loading={statusUpdating} onClick={handleStatusAdvance} className="flex-1 min-h-10" disabled={!driverAction.nextStatus}>
            {driverAction.label}
          </Button>
          <a href={routeMapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full min-h-10">Navigate</Button>
          </a>
        </DriverBottomActionBar>
      )}
      </div>
    </AppShell>
  );
}
