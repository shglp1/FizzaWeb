'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DriverGpsPanel } from '@/components/DriverGpsPanel';
import { DriverTripMoreMenu } from '@/components/driver/DriverTripMoreMenu';
import { TripChatDrawer } from '@/components/trips/TripChatDrawer';
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
  CHAT_UNAVAILABLE_BEFORE_LABEL,
  DRIVER_ROUTE_SHEET_TABS,
  buildDriverTripsListParams,
  fmtDriverDate,
  fmtDriverTime,
  formatCountdown,
  getDriverPrimaryAction,
  isWithinTrackingWindow,
  minutesUntilPickup,
  type DriverTripTab,
} from '@/lib/ui/driverPortal';
import { groupTripsByDate as groupByDate } from '@/lib/ui/driverRouteSheet';
import { Calendar, CheckCircle2, Clock, MapPin, MessageSquare, Shield } from 'lucide-react';
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

export function DriverRouteSheet() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState<DriverTripTab>('today');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [chatTrip, setChatTrip] = useState<Trip | null>(null);
  const [chatMeta, setChatMeta] = useState<Record<string, { windowOpen: boolean }>>({});
  const [noShowTarget, setNoShowTarget] = useState<Trip | null>(null);
  const [noShowReason, setNoShowReason] = useState('');
  const [lateTarget, setLateTarget] = useState<Trip | null>(null);
  const [lateReason, setLateReason] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [gpsActive, setGpsActive] = useState(false);

  const today = new Date().toISOString().split('T')[0]!;

  const loadTrips = useCallback(async (pageNum = 1, append = false) => {
    setPageError('');
    const params = buildDriverTripsListParams(activeTab, pageNum, 50);
    const res = await tripService.list(params);

    if (res.data) {
      const list = Array.isArray(res.data) ? (res.data as Trip[]) : [];
      setTrips(append ? (prev) => [...prev, ...list] : list);
      const meta = res.meta as { total?: number; page?: number; totalPages?: number; limit?: number } | undefined;
      if (meta?.total != null) setTotalCount(meta.total);
      setHasMore((meta?.page ?? 1) < (meta?.totalPages ?? 1));
    } else {
      setPageError(res.error?.message ?? 'Failed to load trips.');
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadTrips(1, false);
  }, [loadTrips]);

  useEffect(() => {
    const ids = trips.slice(0, 10).map((t) => t.id);
    ids.forEach(async (id) => {
      const res = await tripService.getChat(id);
      if (res.data) {
        setChatMeta((prev) => ({ ...prev, [id]: { windowOpen: !!res.data.windowOpen } }));
      }
    });
  }, [trips]);

  const todayTrips = trips.filter((t) => t.scheduledDate.startsWith(today));
  const activeTrip = trips.find((t) => ACTIVE.has(t.status));
  const nextTrip = todayTrips
    .filter((t) => UPCOMING.has(t.status))
    .sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''))[0];
  const completedToday = todayTrips.filter((t) => t.status === 'COMPLETED').length;
  const remainingToday = todayTrips.filter((t) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(t.status)).length;

  function displayTrips(): Trip[] {
    switch (activeTab) {
      case 'today':
        return todayTrips.sort((a, b) => (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? ''));
      case 'week':
        return [...trips].sort((a, b) => {
          const d = a.scheduledDate.localeCompare(b.scheduledDate);
          return d !== 0 ? d : (a.scheduledPickupTime ?? '').localeCompare(b.scheduledPickupTime ?? '');
        });
      default:
        return trips;
    }
  }

  const shown = displayTrips();
  const grouped = activeTab !== 'today' && activeTab !== 'active' ? groupByDate(shown) : null;
  const showingFrom = trips.length === 0 ? 0 : (page - 1) * 50 + 1;
  const showingTo = trips.length === 0 ? 0 : (page - 1) * 50 + trips.length;

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

  async function submitNoShow() {
    if (!noShowTarget) return;
    setActionLoading(true);
    const res = await tripService.updateStatus(noShowTarget.id, 'NO_SHOW', { statusReason: noShowReason.trim() || 'Rider no-show' });
    setActionLoading(false);
    setNoShowTarget(null);
    setNoShowReason('');
    if (res.data) {
      setActionMsg('No-show recorded.');
      setLoading(true);
      loadTrips(page, false);
    } else {
      setActionMsg(res.error?.message ?? 'Could not record no-show.');
    }
  }

  async function submitLate() {
    if (!lateTarget) return;
    setActionLoading(true);
    const res = await tripService.reportLate(lateTarget.id, 'RIDER', lateReason.trim() || undefined);
    setActionLoading(false);
    setLateTarget(null);
    setLateReason('');
    if (res.data) {
      setActionMsg('Late report submitted.');
    } else {
      setActionMsg(res.error?.message ?? 'Could not submit report.');
    }
  }

  function copyAddress(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
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
        gpsIndicator={gpsActive ? 'active' : 'idle'}
      />

      {actionMsg && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">{actionMsg}</p>
      )}

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
            gpsStatus={gpsActive ? 'active' : 'idle'}
            primaryAction={activeAction?.label}
            onPrimaryAction={handleActiveAdvance}
            secondaryActions={
              <>
                <a href={navUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><Navigation className="h-3.5 w-3.5" aria-hidden />Navigate</Button></a>
                <Link href={`/tracking/${activeTrip.id}`}><Button variant="ghost" size="sm">Live map</Button></Link>
                <Button variant="ghost" size="sm" onClick={() => setChatTrip(activeTrip)}><MessageSquare className="h-3.5 w-3.5" aria-hidden />Chat</Button>
              </>
            }
          />
          {isTrackableStatus(activeTrip.status as TripStatus) && (
            <div className="mt-2 rounded-xl border border-gray-100 bg-white p-3">
              <DriverGpsPanel
                tripId={activeTrip.id}
                withinWindow={isWithinTrackingWindow(activeTrip.scheduledPickupTime)}
                onSharingChange={setGpsActive}
              />
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
              <>
                <a href={tripToGoogleMapsUrl(nextTrip)} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">Navigate</Button>
                </a>
                <Button variant="ghost" size="sm" onClick={() => setChatTrip(nextTrip)}><MessageSquare className="h-3.5 w-3.5" aria-hidden />Chat</Button>
              </>
            }
          />
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(v) => setActiveTab(v as DriverTripTab)} />
      </div>

      <p className="text-xs font-medium text-gray-500 mt-3 mb-3">
        Showing {showingFrom}–{showingTo} of {totalCount || trips.length} trips
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
        <Button variant="ghost" size="sm" className="min-h-10" onClick={() => activeTrip && setChatTrip(activeTrip)}><MessageSquare className="h-4 w-4" aria-hidden /></Button>
        <Link href={`/tracking/${activeTrip?.id}`}><Button variant="ghost" size="sm" className="min-h-10">GPS</Button></Link>
        <Link href="/safety"><Button variant="ghost" size="sm" className="min-h-10"><Shield className="h-4 w-4" aria-hidden /></Button></Link>
      </DriverBottomActionBar>

      {chatTrip && (
        <TripChatDrawer
          open={!!chatTrip}
          onClose={() => setChatTrip(null)}
          tripId={chatTrip.id}
          userRole="DRIVER"
          tripSummary={{
            riderName: chatTrip.rider?.name ?? 'Rider',
            pickup: chatTrip.pickupLocation,
            dropoff: chatTrip.dropoffLocation,
            scheduledPickupTime: chatTrip.scheduledPickupTime,
          }}
        />
      )}

      {noShowTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900">Mark rider no-show?</h3>
            <p className="text-sm text-gray-500 mt-1">Only if the rider did not appear after you arrived.</p>
            <textarea value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} placeholder="Reason (optional)" rows={2} className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <div className="flex gap-2 mt-4">
              <Button variant="danger" size="sm" loading={actionLoading} onClick={submitNoShow} className="flex-1">Mark no-show</Button>
              <Button variant="ghost" size="sm" onClick={() => { setNoShowTarget(null); setNoShowReason(''); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {lateTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900">Report rider late?</h3>
            <p className="text-sm text-gray-500 mt-1">Notify dispatch that the rider is late at pickup.</p>
            <textarea value={lateReason} onChange={(e) => setLateReason(e.target.value)} placeholder="Details (optional)" rows={2} className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <div className="flex gap-2 mt-4">
              <Button variant="primary" size="sm" loading={actionLoading} onClick={submitLate} className="flex-1">Submit</Button>
              <Button variant="ghost" size="sm" onClick={() => { setLateTarget(null); setLateReason(''); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderTripCard(trip: Trip) {
    const status = trip.status as TripStatus;
    const within = isWithinTrackingWindow(trip.scheduledPickupTime);
    const action = getDriverPrimaryAction(status, within);
    const isCancelled = CANCELLED.has(trip.status);
    const chatOpen = chatMeta[trip.id]?.windowOpen;
    const chatReason = chatOpen === false ? CHAT_UNAVAILABLE_BEFORE_LABEL : undefined;

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
            <Button
              variant="ghost"
              size="sm"
              title={chatReason}
              onClick={() => setChatTrip(trip)}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              Chat
            </Button>
            <DriverTripMoreMenu
              trip={trip}
              onReportLate={() => setLateTarget(trip)}
              onMarkNoShow={() => setNoShowTarget(trip)}
              onCopyAddress={(_, text) => copyAddress(text)}
            />
          </>
        }
      />
    );
  }
}
