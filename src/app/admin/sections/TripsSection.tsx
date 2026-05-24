'use client';

import { RefreshCw, Calendar, MapPin, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { tripService } from '@/services/tripService';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';
import { Button, Alert, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { TripAssignDriverModal } from '@/components/admin/TripAssignDriverModal';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import { TripOperationsBoard } from './TripOperationsBoard';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminFilterSelect,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import {
  formatDispatchNoteSummary,
  formatGenerateTripsExplanation,
  formatGenerateTripsSummary,
  formatLegType,
  formatRouteSummary,
  formatTripDateTime,
  getPrimaryTripAction,
  getTripCardBadges,
  type TripFilterPreset,
} from '@/lib/ui/adminTrips';

type AdminTrip = {
  id: string;
  status: TripStatus;
  needsDispatch?: boolean;
  dispatchNote?: string | null;
  legType?: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  rider: { id: string; name: string; relationship: string } | null;
  driver: { id: string; rating: string | null; profile: { fullName: string; phone: string | null } | null } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  subscription: {
    id: string;
    subscriptionType: string;
    user?: { fullName: string } | null;
  } | null;
};

type DispatchQueueItem = {
  id: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  dispatchNote: string | null;
  legType?: string;
  rider: { name: string } | null;
  subscription?: {
    user?: { fullName: string } | null;
    assignedDriver?: { profile?: { fullName: string } | null } | null;
  } | null;
};

type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

type GenResult = {
  generated: number;
  confirmed: number;
  needsDispatch: number;
  skipped: number;
  failed: number;
  startDate: string;
  endDate: string;
};

const TRIP_STATUS_FILTERS = ['', 'SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const PRESET_FILTERS: { value: TripFilterPreset; label: string }[] = [
  { value: '', label: 'All trips' },
  { value: 'needs_dispatch', label: 'Needs dispatch' },
  { value: 'unassigned', label: 'Unassigned only' },
  { value: 'active', label: 'Active only' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function TripsSection() {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [presetFilter, setPresetFilter] = useState<TripFilterPreset>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [refreshToken, setRefreshToken] = useState(0);

  const [assignTrip, setAssignTrip] = useState<AdminTrip | null>(null);
  const [assignMode, setAssignMode] = useState<'assign' | 'reassign'>('assign');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate] = useState('');
  const [genMsg, setGenMsg] = useState<{ text: string; type: 'success' | 'error'; result?: GenResult } | null>(null);

  const [dispatchQueue, setDispatchQueue] = useState<DispatchQueueItem[]>([]);
  const [dispatchTotal, setDispatchTotal] = useState(0);
  const [dispatchLoading, setDispatchLoading] = useState(true);

  const loadDispatchQueue = useCallback(() => {
    setDispatchLoading(true);
    tripService.adminNeedsDispatch({ limit: 20 }).then((res) => {
      if (res.data?.trips) {
        setDispatchQueue(res.data.trips);
        setDispatchTotal(res.data.meta?.total ?? res.data.trips.length);
      }
      setDispatchLoading(false);
    });
  }, []);

  const loadTrips = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setPageError('');
    const filters: Parameters<typeof tripService.adminList>[0] = {
      date: dateFilter || undefined,
      page,
      limit,
      q: searchQuery.trim() || undefined,
    };
    if (presetFilter === 'needs_dispatch') filters.needsDispatch = true;
    else if (presetFilter === 'unassigned') filters.unassigned = true;
    else if (presetFilter === 'active') filters.active = true;
    else if (presetFilter === 'completed') filters.status = 'COMPLETED';
    else if (presetFilter === 'cancelled') filters.status = 'CANCELLED';
    else if (statusFilter) filters.status = statusFilter;

    tripService.adminList(filters).then((res) => {
      if (res.data) {
        setTrips(res.data.trips ?? []);
        setMeta(res.data.meta ?? null);
        setLastUpdated(new Date());
      } else {
        setPageError(res.error?.message ?? 'Failed to load trips.');
      }
      setLoading(false);
    });
  }, [statusFilter, presetFilter, searchQuery, dateFilter, page, limit]);

  useEffect(() => { loadTrips(); }, [loadTrips]);
  useEffect(() => { loadDispatchQueue(); }, [loadDispatchQueue, genMsg, toast, refreshToken]);
  useEffect(() => {
    const id = setInterval(() => loadTrips(true), 25_000);
    return () => clearInterval(id);
  }, [loadTrips]);

  const bumpRefresh = () => {
    setRefreshToken((n) => n + 1);
    loadTrips(true);
    loadDispatchQueue();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg(null);
    const res = await tripService.adminGenerateTrips(genStartDate || undefined, genEndDate || undefined);
    setGenerating(false);
    if (res.data) {
      const result: GenResult = {
        generated: res.data.generatedCount ?? 0,
        confirmed: res.data.confirmedCount ?? 0,
        needsDispatch: res.data.needsDispatchCount ?? 0,
        skipped: res.data.skippedCount ?? 0,
        failed: res.data.failedCount ?? 0,
        startDate: res.data.startDate ?? '',
        endDate: res.data.endDate ?? '',
      };
      setGenMsg({
        text: formatGenerateTripsSummary(result),
        type: 'success',
        result,
      });
      bumpRefresh();
    } else {
      setGenMsg({ text: res.error?.message ?? 'Trip generation failed. Please try again.', type: 'error' });
    }
  };

  const handleLateCheck = async () => {
    await tripService.adminCheckLate();
    bumpRefresh();
  };

  const openAssignFromQueue = (item: DispatchQueueItem) => {
    setAssignTrip({
      id: item.id,
      status: 'SCHEDULED',
      needsDispatch: true,
      dispatchNote: item.dispatchNote,
      legType: item.legType,
      scheduledDate: item.scheduledDate,
      scheduledPickupTime: item.scheduledPickupTime,
      scheduledDropoffTime: null,
      actualPickupTime: null,
      pickupLocation: item.pickupLocation,
      dropoffLocation: item.dropoffLocation,
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
      rider: item.rider ? { id: '', name: item.rider.name, relationship: '' } : null,
      driver: null,
      vehicle: null,
      subscription: null,
    });
    setAssignMode('assign');
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <AdminSectionHeader
        title="Trip Operations"
        subtitle="Command center for daily trip monitoring, dispatch, and driver assignment"
        lastUpdated={lastUpdated?.toLocaleTimeString()}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={bumpRefresh} className="min-h-[44px]">
              <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleLateCheck} className="min-h-[44px]">Check late</Button>
          </div>
        }
        secondaryAction={
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs">
            <button
              type="button"
              className={`px-4 py-2.5 min-h-[44px] ${viewMode === 'board' ? 'bg-fizza-primary text-white' : 'bg-white text-gray-600'}`}
              onClick={() => setViewMode('board')}
            >
              Board
            </button>
            <button
              type="button"
              className={`px-4 py-2.5 min-h-[44px] ${viewMode === 'list' ? 'bg-fizza-primary text-white' : 'bg-white text-gray-600'}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        }
      />

      {toast && <Alert variant={toast.type} onClose={() => setToast(null)}>{toast.text}</Alert>}

      {/* Generate trips */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 shadow-card">
        <div className="flex items-start gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Generate trips</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Creates trips from active paid subscriptions. Auto-confirms the default driver when feasible; otherwise trips go to Needs Dispatch.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Start</label>
            <input type="date" className="input text-sm h-11 min-h-[44px] w-full" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">End</label>
            <input type="date" className="input text-sm h-11 min-h-[44px] w-full" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)} />
          </div>
          <Button variant="primary" size="sm" loading={generating} onClick={handleGenerate} className="min-h-[44px] w-full sm:w-auto">
            {generating ? 'Generating…' : 'Generate trips'}
          </Button>
        </div>
        {genMsg && (
          <Alert variant={genMsg.type} className="mt-3" onClose={() => setGenMsg(null)}>
            <p className="font-medium">{genMsg.text}</p>
            {genMsg.result && (
              <p className="text-sm mt-1 opacity-90">{formatGenerateTripsExplanation(genMsg.result)}</p>
            )}
            {genMsg.type === 'error' && (
              <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={handleGenerate} loading={generating}>
                Retry generation
              </Button>
            )}
          </Alert>
        )}
      </div>

      {/* Needs dispatch queue — always visible */}
      <div className={`rounded-2xl border p-4 shadow-card ${dispatchTotal > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-100 bg-emerald-50/20'}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            {dispatchTotal > 0 ? (
              <><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> Needs dispatch ({dispatchTotal})</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> Needs dispatch</>
            )}
          </h3>
        </div>
        {dispatchLoading ? (
          <p className="text-sm text-gray-500">Loading dispatch queue…</p>
        ) : dispatchQueue.length === 0 ? (
          <p className="text-sm text-emerald-800">No trips need dispatch. All feasible trips are confirmed or awaiting generation.</p>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-3">
              These trips could not auto-assign the default driver due to timeline conflicts. Assign a driver manually.
            </p>
            <ul className="space-y-3">
              {dispatchQueue.map((t) => (
                <li key={t.id} className="rounded-xl border border-amber-100 bg-white p-3 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">
                        {t.rider?.name ?? 'Rider'} · {formatTripDateTime(t.scheduledDate, t.scheduledPickupTime)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate" title={formatRouteSummary(t.pickupLocation, t.dropoffLocation, 120)}>
                        {formatRouteSummary(t.pickupLocation, t.dropoffLocation)} · {formatLegType(t.legType)}
                      </p>
                      {t.subscription?.user?.fullName && (
                        <p className="text-xs text-gray-400 mt-0.5">Parent: {t.subscription.user.fullName}</p>
                      )}
                      {t.subscription?.assignedDriver?.profile?.fullName && (
                        <p className="text-xs text-gray-500 mt-0.5">Default driver: {t.subscription.assignedDriver.profile.fullName}</p>
                      )}
                      {t.dispatchNote && (
                        <p className="text-xs text-amber-800 mt-2 bg-amber-50 rounded-lg px-2 py-1.5">
                          {formatDispatchNoteSummary(t.dispatchNote, 160)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="primary" size="sm" className="min-h-[44px]" onClick={() => openAssignFromQueue(t)}>
                        Assign driver
                      </Button>
                      <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => { setViewMode('board'); setPresetFilter('needs_dispatch'); setPage(1); }}>
                        View details
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Shared filters for both views */}
      <AdminToolbar
        filters={[
          {
            id: 'trip-date',
            label: 'Date',
            element: (
              <input
                id="trip-date"
                type="date"
                className="input text-sm h-11 w-full min-h-[44px]"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              />
            ),
          },
          {
            id: 'trip-preset',
            label: 'View',
            element: (
              <AdminFilterSelect
                id="trip-preset"
                value={presetFilter}
                onChange={(v) => { setPresetFilter(v as TripFilterPreset); setStatusFilter(''); setPage(1); }}
                options={PRESET_FILTERS.map((p) => ({ value: p.value, label: p.label }))}
              />
            ),
          },
          {
            id: 'trip-status',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="trip-status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPresetFilter(''); setPage(1); }}
                options={TRIP_STATUS_FILTERS.map((s) => ({ value: s, label: s ? getDisplayLabel(s as TripStatus) : 'Any status' }))}
              />
            ),
          },
          {
            id: 'trip-search',
            label: 'Search',
            element: (
              <input
                id="trip-search"
                type="search"
                placeholder="Rider, parent, route…"
                className="input text-sm h-11 w-full min-h-[44px]"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            ),
          },
        ]}
      />

      {viewMode === 'board' && (
        <TripOperationsBoard
          date={dateFilter}
          onDateChange={(d) => { setDateFilter(d); setPage(1); }}
          onRefresh={bumpRefresh}
          refreshToken={refreshToken}
        />
      )}

      {viewMode === 'list' && (
        <>
          {loading ? (
            <AdminSectionLoading message="Loading trips…" />
          ) : pageError ? (
            <ErrorState message={pageError} onRetry={() => loadTrips()} />
          ) : trips.length === 0 ? (
            <AdminEmptyState
              icon={Calendar}
              title="No trips found"
              description={presetFilter === 'needs_dispatch' ? 'No trips need dispatch for this date.' : 'No trips match the selected filters.'}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {trips.map((trip) => {
                const badges = getTripCardBadges(trip);
                const action = getPrimaryTripAction(trip);
                const mapsUrl = tripToGoogleMapsUrl(trip);
                return (
                  <AdminDataCard
                    key={trip.id}
                    title={trip.rider?.name ?? 'Trip'}
                    subtitle={formatTripDateTime(trip.scheduledDate, trip.scheduledPickupTime)}
                    badges={
                      <>
                        <AdminStatusBadge status={trip.status} label={getDisplayLabel(trip.status)} />
                        {badges.map((b) => (
                          <span key={b.key} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{b.label}</span>
                        ))}
                      </>
                    }
                    metadata={
                      <>
                        <AdminMetaItem label="Leg" value={formatLegType(trip.legType)} />
                        <AdminMetaItem label="Route" value={formatRouteSummary(trip.pickupLocation, trip.dropoffLocation, 28)} />
                        <AdminMetaItem label="Driver" value={trip.driver?.profile?.fullName ?? 'Unassigned'} />
                        <AdminMetaItem label="Parent" value={trip.subscription?.user?.fullName ?? '—'} />
                      </>
                    }
                    compact
                    actions={
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Open route in maps">
                        <MapPin className="h-4 w-4" aria-hidden />
                      </a>
                    }
                  >
                    {trip.dispatchNote && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mb-2">{formatDispatchNoteSummary(trip.dispatchNote)}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(action === 'assign' || trip.needsDispatch) && (
                        <Button variant="primary" size="sm" onClick={() => { setAssignTrip(trip); setAssignMode('assign'); }} className="min-h-[44px]">
                          Assign driver
                        </Button>
                      )}
                      {action === 'reassign' && (
                        <Button variant="outline" size="sm" onClick={() => { setAssignTrip(trip); setAssignMode('reassign'); }} className="min-h-[44px]">
                          Reassign
                        </Button>
                      )}
                      {action === 'track' && (
                        <Link href={`/tracking/${trip.id}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="min-h-[44px]">Track</Button>
                        </Link>
                      )}
                    </div>
                  </AdminDataCard>
                );
              })}
            </div>
          )}

          {meta && (
            <AdminPagination
              meta={meta}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
              className="mt-5"
            />
          )}
        </>
      )}

      {assignTrip && (
        <TripAssignDriverModal
          open={!!assignTrip}
          tripId={assignTrip.id}
          tripLabel={assignTrip.rider?.name ?? 'Trip'}
          tripDate={assignTrip.scheduledDate}
          tripPickupTime={assignTrip.scheduledPickupTime}
          pickup={assignTrip.pickupLocation}
          dropoff={assignTrip.dropoffLocation}
          mode={assignMode}
          onClose={() => setAssignTrip(null)}
          onSuccess={(msg) => {
            setToast({ text: msg, type: 'success' });
            setAssignTrip(null);
            bumpRefresh();
          }}
        />
      )}
    </div>
  );
}
