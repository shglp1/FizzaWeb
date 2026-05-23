'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader, Card, StatusBadge, Button, LoadingState, ErrorState, EmptyState, Alert, Tabs,
} from '@/components/ui';
import { tripService } from '@/services/tripService';
import { TRIP_STATUS_LABEL, DRIVER_TRANSITIONS } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
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
  rider: { name: string; school: string | null; relationship: string } | null;
  vehicle: { model: string; plateNumber: string; color: string } | null;
};

type TabKey = 'today' | 'tomorrow' | 'upcoming' | 'active' | 'completed' | 'cancelled';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'purple' | 'success' | 'danger' | 'orange'> = {
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

const ACTIVE_STATUSES = new Set(['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF']);
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'DRIVER_ASSIGNED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'NO_SHOW']);

// Label for action buttons based on current status
const ACTION_LABEL: Partial<Record<TripStatus, string>> = {
  DRIVER_ASSIGNED:  'Start Pre-trip',
  PRE_TRIP:         'Mark En Route',
  ON_THE_WAY:       'Mark Arrived Pickup',
  ARRIVED_PICKUP:   'Confirm Pickup',
  PICKED_UP:        'En Route to Drop-off',
  EN_ROUTE_DROPOFF: 'Mark Arrived Drop-off',
  ARRIVED_DROPOFF:  'Complete Trip',
};

const NEXT_STATUS: Partial<Record<TripStatus, TripStatus>> = {
  DRIVER_ASSIGNED:  'PRE_TRIP',
  PRE_TRIP:         'ON_THE_WAY',
  ON_THE_WAY:       'ARRIVED_PICKUP',
  ARRIVED_PICKUP:   'PICKED_UP',
  PICKED_UP:        'EN_ROUTE_DROPOFF',
  EN_ROUTE_DROPOFF: 'ARRIVED_DROPOFF',
  ARRIVED_DROPOFF:  'COMPLETED',
};

function fmtTime(t: string | null) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dt.toDateString() === today.toDateString()) return 'Today';
  if (dt.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function minsUntil(t: string | null): number | null {
  if (!t) return null;
  return Math.round((new Date(t).getTime() - Date.now()) / 60_000);
}

function groupByDate(trips: Trip[]): Map<string, Trip[]> {
  const map = new Map<string, Trip[]>();
  for (const t of trips) {
    const key = t.scheduledDate.split('T')[0]!;
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return map;
}

// ─── Active Trip Panel ────────────────────────────────────────────────────────

function ActiveTripPanel({
  trip,
  onStatusUpdate,
}: {
  trip: Trip;
  onStatusUpdate: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [showNoShow, setShowNoShow] = useState(false);

  const status = trip.status as TripStatus;
  const nextStatus = NEXT_STATUS[status];
  const actionLabel = ACTION_LABEL[status];
  const canNoShow = status === 'ARRIVED_PICKUP';
  const canReportRiderLate = status === 'ARRIVED_PICKUP';

  async function handleReportRiderLate() {
    setUpdating(true);
    setUpdateError('');
    const res = await tripService.reportLate(trip.id, 'RIDER', 'Rider not ready at pickup');
    setUpdating(false);
    if (res.error) {
      setUpdateError(res.error.message ?? 'Failed to report rider late.');
    } else {
      onStatusUpdate();
    }
  }

  async function handleAdvance() {
    if (!nextStatus) return;
    setUpdating(true);
    setUpdateError('');
    const res = await tripService.updateStatus(trip.id, nextStatus);
    setUpdating(false);
    if (res.error) {
      setUpdateError(res.error.message ?? 'Failed to update status.');
    } else {
      onStatusUpdate();
    }
  }

  async function handleNoShow() {
    const reason = window.prompt('No-show reason (required):');
    if (!reason?.trim()) {
      setUpdateError('No-show requires a reason.');
      return;
    }
    setUpdating(true);
    setUpdateError('');
    const res = await tripService.updateStatus(trip.id, 'NO_SHOW', { statusReason: reason.trim() });
    setUpdating(false);
    if (res.error) {
      setUpdateError(res.error.message ?? 'Failed to update status.');
    } else {
      onStatusUpdate();
    }
  }

  const minsToPickup = minsUntil(trip.scheduledPickupTime);

  return (
    <Card className="border-2 border-fizza-secondary/40 bg-emerald-50/20 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Active Trip</span>
          </div>
          <h2 className="text-base font-semibold text-gray-900">{trip.rider?.name ?? 'Rider'}</h2>
          {trip.rider?.school && <p className="text-xs text-gray-500">{trip.rider.school}</p>}
        </div>
        <StatusBadge variant={STATUS_VARIANT[trip.status] ?? 'info'}>
          {TRIP_STATUS_LABEL[status] ?? trip.status}
        </StatusBadge>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Pickup</p>
          <p className="font-semibold text-gray-800">{fmtTime(trip.scheduledPickupTime)}</p>
          <p className="text-xs text-gray-500 truncate">{trip.pickupLocation}</p>
          {trip.pickupLat != null && trip.pickupLng != null && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${trip.pickupLat},${trip.pickupLng}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Navigate ↗
            </a>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Drop-off</p>
          <p className="font-semibold text-gray-800">{fmtTime(trip.scheduledDropoffTime)}</p>
          <p className="text-xs text-gray-500 truncate">{trip.dropoffLocation}</p>
          {trip.dropoffLat != null && trip.dropoffLng != null && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${trip.dropoffLat},${trip.dropoffLng}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Navigate ↗
            </a>
          )}
        </div>
      </div>

      {minsToPickup != null && minsToPickup > 0 && status === 'PRE_TRIP' && (
        <p className="text-xs text-amber-600 mb-3">⏱ {minsToPickup} min until scheduled pickup</p>
      )}
      {minsToPickup != null && minsToPickup < -5 && ACTIVE_STATUSES.has(status) && status !== 'PICKED_UP' && status !== 'EN_ROUTE_DROPOFF' && status !== 'ARRIVED_DROPOFF' && (
        <Alert variant="warning" className="mb-3">Driver is {Math.abs(minsToPickup)} min behind schedule.</Alert>
      )}

      {updateError && <Alert variant="error" className="mb-3">{updateError}</Alert>}

      <div className="flex flex-wrap gap-2">
        {actionLabel && nextStatus && (
          <Button variant="primary" size="sm" loading={updating} onClick={handleAdvance}>
            {actionLabel}
          </Button>
        )}
        {canReportRiderLate && (
          <Button variant="outline" size="sm" loading={updating} onClick={handleReportRiderLate}>
            Rider Late
          </Button>
        )}
        {canNoShow && (
          <Button
            variant="danger-outline"
            size="sm"
            loading={updating && showNoShow}
            onClick={() => { setShowNoShow(true); handleNoShow(); }}
          >
            No Show
          </Button>
        )}
        <Link href={`/tracking/${trip.id}`}>
          <Button variant="outline" size="sm">Live Map</Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Trip Row Card ─────────────────────────────────────────────────────────────

function TripRowCard({ trip, onStatusUpdate }: { trip: Trip; onStatusUpdate: () => void }) {
  const [expanding, setExpanding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const status = trip.status as TripStatus;
  const nextStatus = NEXT_STATUS[status];
  const actionLabel = ACTION_LABEL[status];
  const isActive = ACTIVE_STATUSES.has(trip.status);

  async function handleAdvance() {
    if (!nextStatus) return;
    setUpdating(true);
    setUpdateError('');
    const res = await tripService.updateStatus(trip.id, nextStatus);
    setUpdating(false);
    if (res.error) {
      setUpdateError(res.error.message ?? 'Failed to update.');
    } else {
      onStatusUpdate();
    }
  }

  return (
    <div
      className={`border rounded-2xl p-4 transition-shadow ${isActive ? 'border-fizza-secondary/40 bg-emerald-50/10' : 'border-gray-100 bg-white'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-fizza-secondary/10 flex items-center justify-center font-bold text-fizza-primary shrink-0">
            {trip.rider?.name?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{trip.rider?.name ?? 'Rider'}</p>
            <p className="text-xs text-gray-400">
              {fmtTime(trip.scheduledPickupTime)} → {fmtTime(trip.scheduledDropoffTime)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge variant={STATUS_VARIANT[trip.status] ?? 'info'}>
            {TRIP_STATUS_LABEL[status] ?? trip.status}
          </StatusBadge>
          <button
            className="text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setExpanding((v) => !v)}
            aria-label={expanding ? 'Collapse' : 'Expand'}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanding ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {expanding && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5">Pickup</p>
              <p className="text-gray-700">{trip.pickupLocation}</p>
              {trip.pickupLat != null && trip.pickupLng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${trip.pickupLat},${trip.pickupLng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >Navigate ↗</a>
              )}
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Drop-off</p>
              <p className="text-gray-700">{trip.dropoffLocation}</p>
              {trip.dropoffLat != null && trip.dropoffLng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${trip.dropoffLat},${trip.dropoffLng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >Navigate ↗</a>
              )}
            </div>
          </div>
          {trip.vehicle && (
            <p className="text-xs text-gray-400">{trip.vehicle.color} {trip.vehicle.model} · {trip.vehicle.plateNumber}</p>
          )}
          {trip.statusReason && (
            <p className="text-xs text-amber-600">Note: {trip.statusReason}</p>
          )}
          {updateError && <Alert variant="error">{updateError}</Alert>}
          <div className="flex gap-2 pt-1">
            {actionLabel && nextStatus && !isActive && (
              <Button variant="primary" size="sm" loading={updating} onClick={handleAdvance}>
                {actionLabel}
              </Button>
            )}
            <Link href={`/tracking/${trip.id}`}>
              <Button variant="ghost" size="sm">Tracking</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('today');

  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const today = new Date().toISOString().split('T')[0]!;
  const tomorrowDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0]!;
  })();

  const loadTrips = useCallback(async (pageNum = 1, append = false) => {
    const from = activeTab === 'today' ? today : activeTab === 'tomorrow' ? tomorrowDate : undefined;
    const to = activeTab === 'today' ? today : activeTab === 'tomorrow' ? tomorrowDate : undefined;
    const res = await tripService.list({
      status: activeTab === 'upcoming' ? 'upcoming' : activeTab === 'active' ? 'active' : activeTab === 'completed' ? 'completed' : activeTab === 'cancelled' ? 'cancelled' : undefined,
      from,
      to,
      page: pageNum,
      limit: 50,
    });
    if (res.data) {
      const list = Array.isArray(res.data) ? (res.data as Trip[]) : [];
      setTrips(append ? (prev) => [...prev, ...list] : list);
      const meta = res.meta as { total?: number; page?: number; totalPages?: number } | undefined;
      if (meta?.total != null) setTotalCount(meta.total);
      setHasMore((meta?.page ?? 1) < (meta?.totalPages ?? 1));
    } else {
      setPageError(res.error?.message ?? 'Failed to load trips.');
    }
    setLoading(false);
  }, [activeTab, today, tomorrowDate]);

  useEffect(() => { setLoading(true); setPage(1); loadTrips(1, false); }, [loadTrips]);

  // Categorised views
  const todayTrips    = trips.filter((t) => t.scheduledDate.startsWith(today));
  const tomorrowTrips = trips.filter((t) => t.scheduledDate.startsWith(tomorrowDate));
  const activeTrips   = trips.filter((t) => ACTIVE_STATUSES.has(t.status));
  const upcomingTrips = trips.filter((t) => UPCOMING_STATUSES.has(t.status));
  const completedTrips= trips.filter((t) => t.status === 'COMPLETED');
  const cancelledTrips= trips.filter((t) => CANCELLED_STATUSES.has(t.status));

  // Today header stats
  const todayCompleted = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const todayActive    = todayTrips.filter((t) => ACTIVE_STATUSES.has(t.status)).length;
  const todayUpcoming  = todayTrips.filter((t) => UPCOMING_STATUSES.has(t.status)).length;
  const nextTrip = upcomingTrips
    .filter((t) => t.scheduledDate.startsWith(today))
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))[0];

  // Active trip (latest active)
  const activeTrip = activeTrips[0] ?? null;

  function tabTrips(): Trip[] {
    switch (activeTab) {
      case 'today':     return todayTrips;
      case 'tomorrow':  return tomorrowTrips;
      case 'upcoming':  return upcomingTrips;
      case 'active':    return activeTrips;
      case 'completed': return completedTrips;
      case 'cancelled': return cancelledTrips;
    }
  }

  const displayTrips = tabTrips();

  // Group non-today tabs by date
  const grouped = activeTab === 'today' ? null : groupByDate(displayTrips);

  const tabs = [
    { label: 'Today',     value: 'today',     count: todayTrips.length },
    { label: 'Tomorrow',  value: 'tomorrow',  count: tomorrowTrips.length },
    { label: 'Upcoming',  value: 'upcoming',  count: upcomingTrips.length },
    { label: 'Active',    value: 'active',    count: activeTrips.length },
    { label: 'Completed', value: 'completed', count: completedTrips.length },
    { label: 'Cancelled', value: 'cancelled', count: cancelledTrips.length },
  ];

  return (
    <AppShell>
      <PageHeader
        title="My Trips"
        subtitle="Your full route sheet"
        action={
          <Link href="/driver/dashboard">
            <Button variant="ghost" size="sm">← Dashboard</Button>
          </Link>
        }
      />

      {loading ? (
        <LoadingState message="Loading your trips…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => { setLoading(true); loadTrips(); }} />
      ) : (
        <div className="space-y-4">

          {/* Today Stats Header */}
          <Card padding="sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-gray-500">
                  {todayTrips.length} trips today · {todayCompleted} done · {todayActive} active · {todayUpcoming} upcoming
                </p>
              </div>
              {nextTrip && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Next pickup</p>
                  <p className="text-sm font-semibold text-fizza-primary">
                    {fmtTime(nextTrip.scheduledPickupTime)}
                    {minsUntil(nextTrip.scheduledPickupTime) != null && (
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        (~{minsUntil(nextTrip.scheduledPickupTime)} min)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[160px]">{nextTrip.rider?.name}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Active Trip Panel */}
          {activeTrip && (
            <ActiveTripPanel
              trip={activeTrip}
              onStatusUpdate={() => { setLoading(true); loadTrips(); }}
            />
          )}

          {/* Tab Bar */}
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(v) => setActiveTab(v as TabKey)}
          />

          <p className="text-xs text-gray-500">
            Showing {displayTrips.length} of {totalCount || trips.length} trips
          </p>
          {hasMore && (
            <Button variant="outline" size="sm" onClick={() => { const n = page + 1; setPage(n); loadTrips(n, true); }}>
              Load more
            </Button>
          )}

          {/* Trip List */}
          {displayTrips.length === 0 ? (
            <EmptyState
              icon="📋"
              title={`No ${activeTab} trips`}
              description={
                activeTab === 'today'
                  ? "You don't have any trips scheduled for today."
                  : `No trips in the ${activeTab} category.`
              }
            />
          ) : grouped ? (
            // Grouped by date (non-today tabs)
            Array.from(grouped.entries()).map(([dateKey, dateTrips]) => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-700">{fmtDate(dateKey)}</p>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {dateTrips.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {dateTrips.map((trip) => (
                    <TripRowCard
                      key={trip.id}
                      trip={trip}
                      onStatusUpdate={() => { setLoading(true); loadTrips(); }}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Today — flat list sorted by pickup time
            <div className="space-y-2">
              {[...displayTrips]
                .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))
                .map((trip) => (
                  <TripRowCard
                    key={trip.id}
                    trip={trip}
                    onStatusUpdate={() => { setLoading(true); loadTrips(); }}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
