'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DriverGpsPanel } from '@/components/DriverGpsPanel';
import {
  DriverActionBar,
  DriverEmptyState,
  DriverErrorState,
  DriverLoadingState,
  DriverPageHeader,
  DriverSafetyKpiRow,
  DriverStatGrid,
  DriverTripCard,
  Navigation,
} from '@/components/driver/DriverUI';
import { Button, Tabs } from '@/components/ui';
import { tripService } from '@/services/tripService';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { isTrackableStatus, TRIP_STATUS_LABEL } from '@/lib/trips/tripLifecycle';
import {
  DRIVER_ROUTE_SHEET_TABS,
  fmtDriverDate,
  fmtDriverTime,
  getDriverPrimaryAction,
  isWithinTrackingWindow,
  type DriverTripTab,
} from '@/lib/ui/driverPortal';
import { groupTripsByDate as groupByDate } from '@/lib/ui/driverRouteSheet';
import { ExternalLink, MapPin, Shield } from 'lucide-react';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';

type Trip = {
  id: string;
  status: string;
  legType: 'OUTBOUND' | 'RETURN';
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  statusReason: string | null;
  rider: { name: string; school: string | null } | null;
};

const ACTIVE = new Set(['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF']);
const UPCOMING = new Set(['SCHEDULED', 'DRIVER_ASSIGNED']);
const CANCELLED = new Set(['CANCELLED', 'NO_SHOW']);

function weekEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0]!;
}

function ActiveTripPanel({ trip, onRefresh }: { trip: Trip; onRefresh: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [err, setErr] = useState('');
  const status = trip.status as TripStatus;
  const action = getDriverPrimaryAction(status, isWithinTrackingWindow(trip.scheduledPickupTime));

  async function advance() {
    if (!action.nextStatus) return;
    setUpdating(true);
    setErr('');
    const res = await tripService.updateStatus(trip.id, action.nextStatus);
    setUpdating(false);
    if (res.error) setErr(res.error.message ?? 'Update failed.');
    else onRefresh();
  }

  async function reportLate() {
    setUpdating(true);
    const res = await tripService.reportLate(trip.id, 'RIDER', 'Rider not ready at pickup');
    setUpdating(false);
    if (res.error) setErr(res.error.message ?? 'Failed.');
    else onRefresh();
  }

  async function noShow() {
    const reason = window.prompt('No-show reason (required):');
    if (!reason?.trim()) return;
    setUpdating(true);
    const res = await tripService.updateStatus(trip.id, 'NO_SHOW', { statusReason: reason.trim() });
    setUpdating(false);
    if (res.error) setErr(res.error.message ?? 'Failed.');
    else onRefresh();
  }

  const navUrl = trip.pickupLat != null && trip.pickupLng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${trip.pickupLat},${trip.pickupLng}`
    : tripToGoogleMapsUrl(trip);

  return (
    <div className="rounded-2xl border-2 border-fizza-secondary/40 bg-emerald-50/30 p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active trip
          </span>
          <h2 className="text-lg font-bold text-gray-900 mt-1">{trip.rider?.name ?? 'Rider'}</h2>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <DriverActionBar>
        {action.kind === 'status' && action.nextStatus && (
          <Button variant="primary" size="sm" loading={updating} onClick={advance}>
            {action.label}
          </Button>
        )}
        <a href={navUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            Navigate
          </Button>
        </a>
        <Link href={`/tracking/${trip.id}`}>
          <Button variant="outline" size="sm">Live map</Button>
        </Link>
        {status === 'ARRIVED_PICKUP' && (
          <>
            <Button variant="outline" size="sm" loading={updating} onClick={reportLate}>Rider late</Button>
            <Button variant="danger-outline" size="sm" loading={updating} onClick={noShow}>No show</Button>
          </>
        )}
        <Link href="/safety">
          <Button variant="ghost" size="sm">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Safety
          </Button>
        </Link>
      </DriverActionBar>
      {isTrackableStatus(status) && <DriverGpsPanel tripId={trip.id} />}
    </div>
  );
}

export function DriverRouteSheet() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState<DriverTripTab>('today');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const today = new Date().toISOString().split('T')[0]!;
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0]!;
  })();

  const loadTrips = useCallback(async (pageNum = 1, append = false) => {
    setPageError('');
    const from =
      activeTab === 'today' ? today :
      activeTab === 'tomorrow' ? tomorrow :
      activeTab === 'week' ? today : undefined;
    const to =
      activeTab === 'today' ? today :
      activeTab === 'tomorrow' ? tomorrow :
      activeTab === 'week' ? weekEndDate() : undefined;

    const status =
      activeTab === 'active' ? 'active' :
      activeTab === 'completed' ? 'completed' :
      activeTab === 'cancelled' ? 'cancelled' :
      activeTab === 'week' ? 'upcoming' : undefined;

    const res = await tripService.list({
      status: status ?? (activeTab === 'today' || activeTab === 'tomorrow' ? undefined : 'upcoming'),
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
  }, [activeTab, today, tomorrow]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadTrips(1, false);
  }, [loadTrips]);

  const todayTrips = trips.filter((t) => t.scheduledDate.startsWith(today));
  const activeTrip = trips.find((t) => ACTIVE.has(t.status));
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const remainingToday = todayTrips.filter((t) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(t.status)).length;
  const nextPickup = todayTrips
    .filter((t) => UPCOMING.has(t.status) || ACTIVE.has(t.status))
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))[0];

  function displayTrips(): Trip[] {
    switch (activeTab) {
      case 'today': return todayTrips.sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''));
      case 'tomorrow': return trips.filter((t) => t.scheduledDate.startsWith(tomorrow));
      case 'week': return trips.filter((t) => {
        const d = t.scheduledDate.split('T')[0]!;
        return d >= today && d <= weekEndDate();
      });
      case 'active': return trips.filter((t) => ACTIVE.has(t.status));
      case 'completed': return trips.filter((t) => t.status === 'COMPLETED');
      case 'cancelled': return trips.filter((t) => CANCELLED.has(t.status));
      default: return trips;
    }
  }

  const shown = displayTrips();
  const grouped = activeTab !== 'today' && activeTab !== 'active' ? groupByDate(shown) : null;

  async function handlePrimary(trip: Trip) {
    const status = trip.status as TripStatus;
    const action = getDriverPrimaryAction(status, isWithinTrackingWindow(trip.scheduledPickupTime));
    if (action.kind === 'status' && action.nextStatus) {
      await tripService.updateStatus(trip.id, action.nextStatus);
      setLoading(true);
      loadTrips(page, false);
    }
  }

  const tabs = DRIVER_ROUTE_SHEET_TABS.map((t) => ({
    ...t,
    count: t.value === 'today' ? todayTrips.length :
      t.value === 'active' ? trips.filter((x) => ACTIVE.has(x.status)).length : undefined,
  }));

  return (
    <>
      <DriverPageHeader
        title="My Route Sheet"
        subtitle={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · ${totalCount || trips.length} assigned trips`}
      />

      {!loading && !pageError && (
        <>
          <DriverStatGrid
            stats={[
              { label: 'Next pickup', value: nextPickup ? fmtDriverTime(nextPickup.scheduledPickupTime) : '—', accent: '#0B683A' },
              { label: 'Active', value: activeTrip ? 1 : 0, accent: '#14A34A' },
              { label: 'Completed today', value: completedToday, accent: '#1D4ED8' },
              { label: 'Remaining', value: remainingToday, accent: '#7C3AED' },
            ]}
          />

          {activeTrip && (
            <div className="mt-4">
              <ActiveTripPanel trip={activeTrip} onRefresh={() => { setLoading(true); loadTrips(page, false); }} />
            </div>
          )}
        </>
      )}

      <div className="mt-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(v) => setActiveTab(v as DriverTripTab)} />
      </div>

      <p className="text-xs text-gray-500 mt-3 mb-3">
        Showing {shown.length} of {totalCount || trips.length} trips
      </p>

      {loading ? (
        <DriverLoadingState message="Loading route sheet…" />
      ) : pageError ? (
        <DriverErrorState message={pageError} onRetry={() => { setLoading(true); loadTrips(); }} />
      ) : shown.length === 0 ? (
        <DriverEmptyState
          title={activeTab === 'today' ? 'No trips today' : `No ${activeTab} trips`}
          description={
            activeTab === 'today'
              ? "You don't have any trips scheduled for today."
              : 'Try another tab or check back later.'
          }
        />
      ) : grouped ? (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([dateKey, dateTrips]) => (
            <div key={dateKey}>
              <p className="text-sm font-semibold text-gray-700 mb-2">{fmtDriverDate(dateKey)}</p>
              <div className="space-y-2">
                {dateTrips.map((trip) => renderTripCard(trip))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((trip) => renderTripCard(trip))}
        </div>
      )}

      {hasMore && !loading && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full sm:w-auto"
          onClick={() => { const n = page + 1; setPage(n); setLoading(true); loadTrips(n, true); }}
        >
          Load more
        </Button>
      )}
    </>
  );

  function renderTripCard(trip: Trip) {
    const status = trip.status as TripStatus;
    const within = isWithinTrackingWindow(trip.scheduledPickupTime);
    const action = getDriverPrimaryAction(status, within);
    const mapsUrl = tripToGoogleMapsUrl(trip);

    return (
      <DriverTripCard
        key={trip.id}
        time={fmtDriverTime(trip.scheduledPickupTime)}
        dateLabel={fmtDriverDate(trip.scheduledDate)}
        riderName={trip.rider?.name ?? 'Rider'}
        pickup={trip.pickupLocation}
        dropoff={trip.dropoffLocation}
        legType={trip.legType ?? 'OUTBOUND'}
        status={status}
        primaryAction={action.kind === 'status' ? action.label : action.kind === 'view' ? action.label : undefined}
        onPrimaryAction={action.kind === 'status' ? () => handlePrimary(trip) : undefined}
        primaryDisabled={action.disabled}
        primaryDisabledReason={action.disabledReason}
        secondaryActions={
          <>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Maps
              </Button>
            </a>
            <Link href={`/tracking/${trip.id}`}>
              <Button variant="ghost" size="sm">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Track
              </Button>
            </Link>
            {isTrackableStatus(status) && within && (
              <Link href={`/tracking/${trip.id}`}>
                <Button variant="ghost" size="sm">GPS</Button>
              </Link>
            )}
          </>
        }
      />
    );
  }
}
