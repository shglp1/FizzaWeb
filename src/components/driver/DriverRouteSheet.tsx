'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DriverGpsPanel } from '@/components/DriverGpsPanel';
import {
  DriverActionHero,
  DriverBottomActionBar,
  DriverCommandHeader,
  DriverEmptyState,
  DriverErrorState,
  DriverKpiCard,
  DriverLoadingState,
  DriverRouteCard,
  DriverSectionTitle,
  Navigation,
} from '@/components/driver/DriverUI';
import { Button, Tabs } from '@/components/ui';
import { tripService } from '@/services/tripService';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { isTrackableStatus } from '@/lib/trips/tripLifecycle';
import {
  DRIVER_ROUTE_SHEET_TABS,
  fmtDriverDate,
  fmtDriverTime,
  formatCountdown,
  getDriverPrimaryAction,
  isWithinTrackingWindow,
  minutesUntilPickup,
  type DriverTripTab,
} from '@/lib/ui/driverPortal';
import { groupTripsByDate as groupByDate } from '@/lib/ui/driverRouteSheet';
import { Calendar, CheckCircle2, Clock, MapPin, MessageSquare, MoreHorizontal, Shield } from 'lucide-react';
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

export function DriverRouteSheet() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState<DriverTripTab>('today');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
      from, to, page: pageNum, limit: 50,
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
  const nextTrip = todayTrips
    .filter((t) => UPCOMING.has(t.status))
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))[0];
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const remainingToday = todayTrips.filter((t) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(t.status)).length;

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
      setActionLoading(true);
      await tripService.updateStatus(trip.id, action.nextStatus);
      setActionLoading(false);
      setLoading(true);
      loadTrips(page, false);
    }
  }

  async function handleActiveAdvance() {
    if (!activeTrip) return;
    const action = getDriverPrimaryAction(activeTrip.status as TripStatus, isWithinTrackingWindow(activeTrip.scheduledPickupTime));
    if (!action.nextStatus) return;
    setActionLoading(true);
    await tripService.updateStatus(activeTrip.id, action.nextStatus);
    setActionLoading(false);
    setLoading(true);
    loadTrips(page, false);
  }

  const tabs = DRIVER_ROUTE_SHEET_TABS.map((t) => ({
    ...t,
    count: t.value === 'today' ? todayTrips.length :
      t.value === 'active' ? trips.filter((x) => ACTIVE.has(x.status)).length : undefined,
  }));

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const activeAction = activeTrip
    ? getDriverPrimaryAction(activeTrip.status as TripStatus, isWithinTrackingWindow(activeTrip.scheduledPickupTime))
    : null;
  const navUrl = activeTrip
    ? tripToGoogleMapsUrl(activeTrip)
    : nextTrip ? tripToGoogleMapsUrl(nextTrip) : '#';

  return (
    <div className="max-w-3xl mx-auto driver-portal pb-28 md:pb-6">
      <DriverCommandHeader
        title="My Route Sheet"
        subtitle={`${totalCount || trips.length} assigned trips`}
        dateLabel={dateLabel}
      />

      {!loading && !pageError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <DriverKpiCard icon={Calendar} value={todayTrips.length} label="Today total" accent="#0B683A" />
          <DriverKpiCard icon={Clock} value={activeTrip ? 1 : 0} label="Active" accent="#14A34A" />
          <DriverKpiCard icon={CheckCircle2} value={completedToday} label="Completed" accent="#1D4ED8" />
          <DriverKpiCard icon={MapPin} value={remainingToday} label="Remaining" accent="#7C3AED" helper={nextTrip ? `Next ${fmtDriverTime(nextTrip.scheduledPickupTime)}` : undefined} />
        </div>
      )}

      {!loading && activeTrip && (
        <div className="mb-4">
          <DriverSectionTitle title="Active trip" />
          <DriverActionHero
            eyebrow="In progress"
            riderName={activeTrip.rider?.name ?? 'Rider'}
            pickup={activeTrip.pickupLocation}
            dropoff={activeTrip.dropoffLocation}
            time={fmtDriverTime(activeTrip.scheduledPickupTime)}
            statusLabel="Active now"
            gpsStatus="idle"
            primaryAction={activeAction?.label}
            onPrimaryAction={handleActiveAdvance}
            secondaryActions={
              <>
                <a href={navUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><Navigation className="h-3.5 w-3.5" aria-hidden />Navigate</Button></a>
                <Link href={`/tracking/${activeTrip.id}`}><Button variant="ghost" size="sm">Live map</Button></Link>
              </>
            }
          />
          {isTrackableStatus(activeTrip.status as TripStatus) && (
            <div className="mt-2 rounded-xl border border-gray-100 bg-white p-3">
              <DriverGpsPanel tripId={activeTrip.id} />
            </div>
          )}
        </div>
      )}

      {!loading && !activeTrip && nextTrip && activeTab === 'today' && (
        <div className="mb-4">
          <DriverSectionTitle title="Next trip" />
          <DriverActionHero
            eyebrow="Up next"
            riderName={nextTrip.rider?.name ?? 'Rider'}
            pickup={nextTrip.pickupLocation}
            dropoff={nextTrip.dropoffLocation}
            time={fmtDriverTime(nextTrip.scheduledPickupTime)}
            countdown={formatCountdown(minutesUntilPickup(nextTrip.scheduledPickupTime))}
            statusLabel="Scheduled"
            gpsStatus="unavailable"
            primaryAction={isWithinTrackingWindow(nextTrip.scheduledPickupTime) ? 'Start pre-trip' : 'View details'}
            onPrimaryAction={() => handlePrimary(nextTrip)}
            secondaryActions={
              <a href={tripToGoogleMapsUrl(nextTrip)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Navigate</Button>
              </a>
            }
          />
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(v) => setActiveTab(v as DriverTripTab)} />
      </div>

      <p className="text-xs font-medium text-gray-500 mt-3 mb-3">
        Showing {shown.length} of {totalCount || trips.length} trips
      </p>

      {loading ? (
        <DriverLoadingState message="Loading route sheet…" />
      ) : pageError ? (
        <DriverErrorState message={pageError} onRetry={() => { setLoading(true); loadTrips(); }} />
      ) : shown.length === 0 ? (
        <DriverEmptyState
          title={activeTab === 'today' ? 'No trips today' : `No ${activeTab} trips`}
          description={activeTab === 'today' ? "You don't have trips scheduled for today." : 'Try another tab.'}
        />
      ) : grouped ? (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([dateKey, dateTrips]) => (
            <div key={dateKey}>
              <DriverSectionTitle title={fmtDriverDate(dateKey)} />
              <div className="space-y-2">{dateTrips.map((trip) => renderTripCard(trip))}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{shown.map((trip) => renderTripCard(trip))}</div>
      )}

      {hasMore && !loading && (
        <Button variant="outline" size="sm" className="mt-4 w-full min-h-10 font-semibold" onClick={() => { const n = page + 1; setPage(n); setLoading(true); loadTrips(n, true); }}>
          Load more trips
        </Button>
      )}

      <DriverBottomActionBar label="Active trip actions" visible={!!activeTrip}>
        {activeAction?.kind === 'status' && activeAction.nextStatus && (
          <Button variant="primary" size="sm" loading={actionLoading} onClick={handleActiveAdvance} className="flex-1 min-h-10">
            {activeAction.label}
          </Button>
        )}
        <a href={navUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="outline" size="sm" className="w-full min-h-10">Navigate</Button>
        </a>
        <Link href={`/tracking/${activeTrip?.id}`}><Button variant="ghost" size="sm" className="min-h-10">GPS</Button></Link>
        <Link href="/safety"><Button variant="ghost" size="sm" className="min-h-10"><Shield className="h-4 w-4" aria-hidden /></Button></Link>
      </DriverBottomActionBar>
    </div>
  );

  function renderTripCard(trip: Trip) {
    const status = trip.status as TripStatus;
    const within = isWithinTrackingWindow(trip.scheduledPickupTime);
    const action = getDriverPrimaryAction(status, within);
    const isCancelled = CANCELLED.has(trip.status);

    return (
      <DriverRouteCard
        key={trip.id}
        time={fmtDriverTime(trip.scheduledPickupTime)}
        dateLabel={fmtDriverDate(trip.scheduledDate)}
        riderName={trip.rider?.name ?? 'Rider'}
        riderMeta={trip.rider?.school ?? undefined}
        pickup={trip.pickupLocation}
        dropoff={trip.dropoffLocation}
        legType={trip.legType ?? 'OUTBOUND'}
        status={status}
        highlighted={ACTIVE.has(trip.status)}
        attention={isCancelled ? 'cancelled' : trip.status === 'SCHEDULED' ? 'dispatch' : undefined}
        primaryAction={action.kind === 'status' ? action.label : action.kind === 'view' ? action.label : undefined}
        onPrimaryAction={action.kind === 'status' ? () => handlePrimary(trip) : undefined}
        primaryDisabled={action.disabled}
        primaryDisabledReason={action.disabledReason}
        secondaryActions={
          <>
            <Link href={`/tracking/${trip.id}`}><Button variant="outline" size="sm"><MapPin className="h-3.5 w-3.5" aria-hidden />Map</Button></Link>
            <Link href="/safety"><Button variant="ghost" size="sm"><Shield className="h-3.5 w-3.5" aria-hidden /></Button></Link>
            <Button variant="ghost" size="sm" title="Chat coming soon" disabled><MessageSquare className="h-3.5 w-3.5" aria-hidden /></Button>
            <Button variant="ghost" size="sm" disabled title="More actions"><MoreHorizontal className="h-3.5 w-3.5" aria-hidden /></Button>
          </>
        }
      />
    );
  }
}
