'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader, Card, StatusBadge, LoadingState, ErrorState, Button, Alert,
} from '@/components/ui';
import { trackingService } from '@/services/trackingService';
import { TRIP_STATUS_LABEL, isTrackableStatus } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { TripEventIcon } from '@/components/trips/TripEventIcon';
import { MapPin, XCircle, ExternalLink, Info, CheckCircle2, CircleOff } from 'lucide-react';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'purple' | 'orange' | 'success' | 'danger'> = {
  DRIVER_ASSIGNED: 'info',
  PRE_TRIP:        'purple',
  ON_THE_WAY:      'purple',
  ARRIVED_PICKUP:  'orange',
  PICKED_UP:       'orange',
  EN_ROUTE_DROPOFF:'purple',
  ARRIVED_DROPOFF: 'orange',
  COMPLETED:       'success',
  CANCELLED:       'danger',
  NO_SHOW:         'danger',
};

function fmtTime(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(dt: string) {
  return new Date(dt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
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

function hasRouteCoords(trip: TrackingTrip): boolean {
  return (
    (toCoord(trip.pickupLat) != null && toCoord(trip.pickupLng) != null) ||
    (toCoord(trip.dropoffLat) != null && toCoord(trip.dropoffLng) != null)
  );
}

// ─── Leaflet Map (SSR-safe) ───────────────────────────────────────────────────

type MapProps = {
  driverLat?: number | null;
  driverLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  stale?: boolean;
};

function TripTrackingMap({
  driverLat,
  driverLng,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  stale = false,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<{ driver?: import('leaflet').Marker; pickup?: import('leaflet').Marker; dropoff?: import('leaflet').Marker }>({});

  useEffect(() => {
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return;

      const iconProto = L.Icon.Default.prototype as unknown as Record<string, unknown>;
      delete iconProto._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current) {
        const points: [number, number][] = [];
        if (driverLat != null && driverLng != null) points.push([driverLat, driverLng]);
        if (pickupLat != null && pickupLng != null) points.push([pickupLat, pickupLng]);
        if (dropoffLat != null && dropoffLng != null) points.push([dropoffLat, dropoffLng]);
        const center = points[0] ?? [24.4672, 39.6112];

        const map = L.map(mapRef.current).setView(center, 14);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      const upsertMarker = (
        key: 'driver' | 'pickup' | 'dropoff',
        lat: number,
        lng: number,
        html: string,
        label: string,
        size: number,
      ) => {
        const icon = L.divIcon({
          html,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const existing = markersRef.current[key];
        if (existing) {
          existing.setLatLng([lat, lng]);
          existing.setIcon(icon);
        } else {
          markersRef.current[key] = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label);
        }
      };

      if (driverLat != null && driverLng != null) {
        upsertMarker(
          'driver',
          driverLat,
          driverLng,
          `<div style="background:${stale ? '#9CA3AF' : '#2563EB'};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
          'Driver',
          16,
        );
      } else if (markersRef.current.driver) {
        map.removeLayer(markersRef.current.driver);
        delete markersRef.current.driver;
      }

      if (pickupLat != null && pickupLng != null) {
        upsertMarker(
          'pickup',
          pickupLat,
          pickupLng,
          `<div style="background:#10B981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          'Pickup',
          14,
        );
      }

      if (dropoffLat != null && dropoffLng != null) {
        upsertMarker(
          'dropoff',
          dropoffLat,
          dropoffLng,
          `<div style="background:#EF4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          'Drop-off',
          14,
        );
      }

      const boundsPoints: [number, number][] = [];
      if (driverLat != null && driverLng != null) boundsPoints.push([driverLat, driverLng]);
      if (pickupLat != null && pickupLng != null) boundsPoints.push([pickupLat, pickupLng]);
      if (dropoffLat != null && dropoffLng != null) boundsPoints.push([dropoffLat, dropoffLng]);
      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 14);
      } else if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [32, 32] });
      }
    }).catch(() => { /* leaflet failed to load */ });

    return () => { cancelled = true; };
  }, [driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, stale]);

  useEffect(() => () => {
    mapInstanceRef.current?.remove();
    mapInstanceRef.current = null;
    markersRef.current = {};
  }, []);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-gray-200"
      style={{ height: 360 }}
      aria-label="Trip tracking map"
    />
  );
}

// ─── Status Timeline ──────────────────────────────────────────────────────────

const TIMELINE_STEPS: { status: TripStatus; label: string }[] = [
  { status: 'DRIVER_ASSIGNED',  label: 'Driver Assigned' },
  { status: 'PRE_TRIP',         label: 'Driver Heading Out' },
  { status: 'ON_THE_WAY',       label: 'En Route to Pickup' },
  { status: 'ARRIVED_PICKUP',   label: 'Arrived at Pickup' },
  { status: 'PICKED_UP',        label: 'Rider Picked Up' },
  { status: 'EN_ROUTE_DROPOFF', label: 'En Route to Drop-off' },
  { status: 'ARRIVED_DROPOFF',  label: 'Arrived at Drop-off' },
  { status: 'COMPLETED',        label: 'Completed' },
];

const STEP_ORDER: TripStatus[] = TIMELINE_STEPS.map((s) => s.status);

function getStepIndex(status: string): number {
  return STEP_ORDER.indexOf(status as TripStatus);
}

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = getStepIndex(currentStatus);
  const isCancelled = currentStatus === 'CANCELLED' || currentStatus === 'NO_SHOW';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
        <XCircle className="h-5 w-5 text-red-500" strokeWidth={1.75} aria-hidden />
        <span>{TRIP_STATUS_LABEL[currentStatus as TripStatus] ?? currentStatus}</span>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {TIMELINE_STEPS.map((step, idx) => {
        const done = currentIdx > idx;
        const active = currentIdx === idx;
        return (
          <li key={step.status} className="flex gap-3 items-start">
            {/* Connector line + dot */}
            <div className="flex flex-col items-center w-5 shrink-0">
              <div
                className={`w-4 h-4 rounded-full border-2 shrink-0 z-10 ${
                  done
                    ? 'bg-emerald-500 border-emerald-500'
                    : active
                    ? 'bg-fizza-secondary border-fizza-secondary'
                    : 'bg-white border-gray-300'
                }`}
              />
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-4 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
            <p
              className={`text-sm pb-3 ${
                active
                  ? 'font-semibold text-fizza-primary'
                  : done
                  ? 'text-emerald-700'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Event Log ────────────────────────────────────────────────────────────────

function EventLog({ events }: { events: TripEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-start gap-2 text-sm">
          <TripEventIcon eventType={ev.eventType} className="h-4 w-4 text-fizza-secondary mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-gray-700">{ev.message ?? ev.eventType.replace(/_/g, ' ')}</p>
            <p className="text-xs text-gray-400">{fmtDateTime(ev.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live GPS guide ───────────────────────────────────────────────────────────

type LiveGpsMode = 'live' | 'waiting_driver' | 'waiting_window' | 'ended' | 'no_driver';

function resolveLiveGpsMode(input: {
  status: string;
  trackable: boolean;
  hasLocation: boolean;
  hasDriver: boolean;
  minutesToPickup: number | null;
}): LiveGpsMode {
  const { status, trackable, hasLocation, hasDriver, minutesToPickup } = input;
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return 'ended';
  if (!hasDriver) return 'no_driver';
  if (hasLocation && trackable) return 'live';
  if (trackable) return 'waiting_driver';
  if (minutesToPickup != null && minutesToPickup > 10) return 'waiting_window';
  return 'waiting_driver';
}

function LiveGpsAvailabilityGuide({
  mode,
  minutesToPickup,
  statusLabel,
}: {
  mode: LiveGpsMode;
  minutesToPickup: number | null;
  statusLabel: string;
}) {
  const modeCopy: Record<LiveGpsMode, { title: string; summary: string; tone: string }> = {
    live: {
      title: 'Live GPS is active',
      summary: 'The driver is sharing location. The map refreshes about every 15 seconds.',
      tone: 'border-emerald-200 bg-emerald-50',
    },
    waiting_driver: {
      title: 'Live GPS not available yet',
      summary: hasDriverWaitingCopy(minutesToPickup),
      tone: 'border-amber-200 bg-amber-50',
    },
    waiting_window: {
      title: 'Live GPS opens soon',
      summary: minutesToPickup != null
        ? `Tracking opens about 10 minutes before pickup (in ~${minutesToPickup} min). Until then, only the route map is shown.`
        : 'Tracking opens about 10 minutes before scheduled pickup.',
      tone: 'border-blue-200 bg-blue-50',
    },
    ended: {
      title: 'Live GPS has ended',
      summary: `This trip is ${statusLabel.toLowerCase()}. You can still view the route map, but the driver is no longer tracked live.`,
      tone: 'border-gray-200 bg-gray-50',
    },
    no_driver: {
      title: 'Live GPS unavailable',
      summary: 'No driver is assigned yet. Live tracking starts after a driver is assigned and begins sharing location.',
      tone: 'border-gray-200 bg-gray-50',
    },
  };

  const copy = modeCopy[mode];

  return (
    <Card className={`mb-4 border ${copy.tone}`}>
      <div className="flex items-start gap-3">
        {mode === 'live' ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
        ) : mode === 'ended' || mode === 'no_driver' ? (
          <CircleOff className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" aria-hidden />
        ) : (
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{copy.title}</p>
          <p className="text-sm text-gray-600 mt-1">{copy.summary}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">When live GPS is available</p>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li>Trip is active (driver heading out, en route, or rider on board)</li>
                <li>About 10 minutes before scheduled pickup</li>
                <li>Driver taps <span className="font-medium">Start Sharing Location</span> on their trips page</li>
                <li>Admins can view location whenever the driver is sharing</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">When live GPS is not available</p>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li>Trip is cancelled, completed, or marked no-show</li>
                <li>More than 10 minutes before pickup (parents)</li>
                <li>Driver has not started location sharing yet</li>
                <li>Driver GPS is off or signal is unavailable</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function hasDriverWaitingCopy(minutesToPickup: number | null): string {
  if (minutesToPickup != null && minutesToPickup <= 10) {
    return 'The tracking window is open, but the driver has not shared live GPS yet. Ask the driver to start sharing from their trips page.';
  }
  return 'The route map is shown now. Live driver location appears once the driver starts sharing GPS.';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrackingDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();

  const [trip, setTrip] = useState<TrackingTrip | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showEvents, setShowEvents] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Poll driver location every 15 seconds while the trip is still open
  useEffect(() => {
    if (!trip) return;
    const terminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(trip.status);
    if (terminal) return;

    pollLocation();
    pollRef.current = setInterval(pollLocation, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [trip, pollLocation]);

  if (loading) return (
    <AppShell>
      <LoadingState message="Loading trip tracking…" />
    </AppShell>
  );

  if (pageError || !trip) return (
    <AppShell>
      <ErrorState message={pageError || 'Trip not found.'} onRetry={fetchTracking} />
    </AppShell>
  );

  const trackable = isTrackableStatus(trip.status as TripStatus);
  const minutesToPickup = minutesUntil(trip.scheduledPickupTime);
  const isCompleted = trip.status === 'COMPLETED';
  const isCancelled = trip.status === 'CANCELLED' || trip.status === 'NO_SHOW';
  const pickupLat = toCoord(trip.pickupLat);
  const pickupLng = toCoord(trip.pickupLng);
  const dropoffLat = toCoord(trip.dropoffLat);
  const dropoffLng = toCoord(trip.dropoffLng);
  const showMap = !!(location || hasRouteCoords(trip));
  const routeMapsUrl = tripToGoogleMapsUrl({
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
  });
  const liveGpsMode = resolveLiveGpsMode({
    status: trip.status,
    trackable,
    hasLocation: !!location,
    hasDriver: !!trip.driver,
    minutesToPickup,
  });
  const statusLabel = TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status;

  return (
    <AppShell>
      <PageHeader
        title={`Tracking — ${trip.rider?.name ?? 'Rider'}`}
        subtitle={new Date(trip.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        action={
          <Link href="/tracking">
            <Button variant="ghost" size="sm">← All trips</Button>
          </Link>
        }
      />

      {/* Status Banner */}
      <div className="mb-4">
        <StatusBadge variant={STATUS_VARIANT[trip.status] ?? 'info'} className="text-sm px-3 py-1.5">
          {TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status}
        </StatusBadge>
        {trip.statusReason && (
          <p className="text-xs text-gray-500 mt-1">{trip.statusReason}</p>
        )}
      </div>

      {/* GPS Stale Warning */}
      {location?.stale && (
        <Alert variant="warning" className="mb-4">
          GPS signal is delayed — location shown may be up to 1 minute old.
        </Alert>
      )}

      {/* Live / route map */}
      {showMap ? (
        <Card className="mb-4 !p-0 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {location ? 'Live Location' : 'Route Map'}
            </p>
            <div className="flex items-center gap-3">
              {location && (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${location.stale ? 'bg-gray-400' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="text-xs text-gray-400">
                    {lastUpdated
                      ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Live'}
                  </span>
                </div>
              )}
              <a
                href={routeMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
              >
                Open in Google Maps
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          </div>
          {isCancelled && (
            <div className="px-4 pb-2">
              <p className="text-xs text-amber-700">Trip cancelled — live driver tracking has ended. Route points are shown below.</p>
            </div>
          )}
          <TripTrackingMap
            driverLat={location?.lat}
            driverLng={location?.lng}
            pickupLat={pickupLat}
            pickupLng={pickupLng}
            dropoffLat={dropoffLat}
            dropoffLng={dropoffLng}
            stale={location?.stale}
          />
          <div className="px-4 py-2 flex flex-wrap gap-4 text-xs text-gray-500">
            {location && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                Driver
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" />
              Pickup
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
              Drop-off
            </span>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="flex flex-col items-center py-6 gap-3 text-gray-500">
            <MapPin className="h-10 w-10 text-fizza-secondary" strokeWidth={1.5} aria-hidden />
            <p className="text-sm font-medium text-center">Map coordinates are not saved for this trip.</p>
            <a
              href={routeMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
            >
              Open route in Google Maps
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </Card>
      )}

      <LiveGpsAvailabilityGuide
        mode={liveGpsMode}
        minutesToPickup={minutesToPickup}
        statusLabel={statusLabel}
      />

      {/* Trip Info + Driver Card */}
      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
        {/* Trip details */}
        <Card>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Trip Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-gray-400">Pickup</p>
                <p className="font-medium text-gray-800">{trip.pickupLocation}</p>
                {trip.scheduledPickupTime && (
                  <p className="text-xs text-gray-500">Scheduled: {fmtTime(trip.scheduledPickupTime)}</p>
                )}
                {trip.actualPickupTime && (
                  <p className="text-xs text-emerald-600">Actual: {fmtTime(trip.actualPickupTime)}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-gray-400">Drop-off</p>
                <p className="font-medium text-gray-800">{trip.dropoffLocation}</p>
                {trip.scheduledDropoffTime && (
                  <p className="text-xs text-gray-500">Scheduled: {fmtTime(trip.scheduledDropoffTime)}</p>
                )}
                {trip.actualDropoffTime && (
                  <p className="text-xs text-emerald-600">Actual: {fmtTime(trip.actualDropoffTime)}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Driver info */}
        {trip.driver?.profile && (
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
              <a
                href={`tel:${trip.driver.profile.phone}`}
                className="mt-3 flex items-center gap-1.5 text-xs text-fizza-secondary font-medium hover:underline"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z" />
                </svg>
                Call driver
              </a>
            )}
          </Card>
        )}
      </div>

      {/* Status Timeline */}
      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Trip Progress</p>
        <StatusTimeline currentStatus={trip.status} />
      </Card>

      {/* Activity Log */}
      {trip.events.length > 0 && (
        <Card>
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowEvents((v) => !v)}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Activity Log ({trip.events.length})
            </p>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-gray-400 transition-transform ${showEvents ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showEvents && (
            <div className="mt-4">
              <EventLog events={trip.events} />
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}
