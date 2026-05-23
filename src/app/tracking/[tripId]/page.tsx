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
    rating: number | null;
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

const EVENT_ICON: Record<string, string> = {
  DRIVER_ASSIGNED:       '🚗',
  LOCATION_SHARING:      '📍',
  NEAR_PICKUP:           '📍',
  ARRIVED_PICKUP:        '🏁',
  RIDER_PICKED_UP:       '✅',
  NEAR_DROPOFF:          '📍',
  ARRIVED_DROPOFF:       '🏫',
  TRIP_COMPLETED:        '🎉',
  DRIVER_LATE:           '⏰',
  RIDER_LATE:            '⏰',
  TRIP_CANCELLED:        '❌',
  NO_SHOW:               '❌',
  STATUS_CHANGE:         '🔄',
  CHAT_MESSAGE_FLAGGED:  '⚠️',
};

// ─── Leaflet Map (SSR-safe) ───────────────────────────────────────────────────

type MapProps = {
  driverLat: number;
  driverLng: number;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  stale: boolean;
};

function LiveMap({ driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, stale }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let isMounted = true;

    // Inject Leaflet CSS
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (!isMounted || !mapRef.current) return;

      // Fix default icon paths
      const iconProto = L.Icon.Default.prototype as unknown as Record<string, unknown>;
      delete iconProto._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (leafletRef.current) {
        // Map already initialised — just update driver marker
        const map = leafletRef.current as ReturnType<typeof L.map>;
        if (markerRef.current) {
          const marker = markerRef.current as ReturnType<typeof L.marker>;
          marker.setLatLng([driverLat, driverLng]);
        }
        map.setView([driverLat, driverLng], map.getZoom());
        return;
      }

      const map = L.map(mapRef.current).setView([driverLat, driverLng], 14);
      leafletRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Driver marker (blue)
      const driverIcon = L.divIcon({
        html: `<div style="background:${stale ? '#9CA3AF' : '#2563EB'};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon })
        .addTo(map)
        .bindPopup('Driver');
      markerRef.current = driverMarker;

      // Pickup marker (green)
      if (pickupLat != null && pickupLng != null) {
        const pickupIcon = L.divIcon({
          html: `<div style="background:#10B981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map).bindPopup('Pickup');
      }

      // Drop-off marker (red)
      if (dropoffLat != null && dropoffLng != null) {
        const dropoffIcon = L.divIcon({
          html: `<div style="background:#EF4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([dropoffLat, dropoffLng], { icon: dropoffIcon }).addTo(map).bindPopup('Drop-off');
      }

      // Fit all markers in view
      const points: [number, number][] = [[driverLat, driverLng]];
      if (pickupLat != null && pickupLng != null) points.push([pickupLat, pickupLng]);
      if (dropoffLat != null && dropoffLng != null) points.push([dropoffLat, dropoffLng]);
      if (points.length > 1) map.fitBounds(points, { padding: [32, 32] });
    }).catch(() => { /* leaflet failed to load */ });

    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update driver marker position when coords change (after initial mount)
  useEffect(() => {
    if (!leafletRef.current || !markerRef.current) return;
    import('leaflet').then((L) => {
      if (!markerRef.current) return;
      const marker = markerRef.current as ReturnType<typeof L.marker>;
      marker.setLatLng([driverLat, driverLng]);
    }).catch(() => { /* ignore */ });
  }, [driverLat, driverLng]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-gray-200"
      style={{ height: 280 }}
      aria-label="Live driver location map"
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
        <span>❌</span>
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
          <span className="text-base leading-none mt-0.5">{EVENT_ICON[ev.eventType] ?? '📌'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-gray-700">{ev.message ?? ev.eventType.replace(/_/g, ' ')}</p>
            <p className="text-xs text-gray-400">{fmtDateTime(ev.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
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
      setLocation(res.data.location as Location | null);
      setLastUpdated(new Date());
    } else {
      setPageError(res.error?.message ?? 'Failed to load tracking data.');
    }
    setLoading(false);
  }, [tripId]);

  const pollLocation = useCallback(async () => {
    const res = await trackingService.getLocation(tripId);
    if (res.data) {
      setLocation(res.data as Location);
      setLastUpdated(new Date());
    }
  }, [tripId]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Poll location every 15 seconds when trip is trackable
  useEffect(() => {
    if (!trip) return;
    if (!isTrackableStatus(trip.status as TripStatus)) return;

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

      {/* Not yet trackable */}
      {!trackable && !isCompleted && !isCancelled && (
        <Alert variant="info" className="mb-4">
          {minutesToPickup != null && minutesToPickup > 10
            ? `Live tracking opens about 10 minutes before pickup (in ~${minutesToPickup} min).`
            : 'Driver location will appear once the driver begins heading out.'}
        </Alert>
      )}

      {/* Live Map */}
      {location && (
        <Card className="mb-4 !p-0 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Location</p>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${location.stale ? 'bg-gray-400' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-xs text-gray-400">
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Live'}
              </span>
            </div>
          </div>
          <LiveMap
            driverLat={location.lat}
            driverLng={location.lng}
            pickupLat={trip.pickupLat}
            pickupLng={trip.pickupLng}
            dropoffLat={trip.dropoffLat}
            dropoffLng={trip.dropoffLng}
            stale={location.stale}
          />
          <div className="px-4 py-2 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" /> Driver</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" /> Pickup</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" /> Drop-off</span>
          </div>
        </Card>
      )}

      {/* GPS unavailable — no location yet but trip is trackable */}
      {!location && trackable && (
        <Card className="mb-4">
          <div className="flex flex-col items-center py-6 gap-2 text-gray-500">
            <span className="text-3xl">📡</span>
            <p className="text-sm font-medium">GPS signal not yet available</p>
            <p className="text-xs text-gray-400">The driver's location will appear here shortly.</p>
          </div>
        </Card>
      )}

      {/* Trip Info + Driver Card */}
      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
        {/* Trip details */}
        <Card>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Trip Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">🟢</span>
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
              <span className="text-gray-400 mt-0.5">🔴</span>
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
                {trip.driver.rating != null && (
                  <p className="text-xs text-amber-500">★ {trip.driver.rating.toFixed(1)}</p>
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
