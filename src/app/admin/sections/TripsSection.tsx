'use client';

import { RefreshCw, Calendar, MapPin } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { tripService } from '@/services/tripService';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';
import { Button, Alert, Pagination, ErrorState } from '@/components/ui';
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

type AdminTrip = {
  id: string;
  status: TripStatus;
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
  subscription: { id: string; subscriptionType: string } | null;
};

type Driver = {
  id: string;
  rating: string | null;
  profile: { fullName: string; phone: string | null } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
};

type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

const TRIP_STATUS_FILTERS = ['', 'SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TripsSection() {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate] = useState('');
  const [genMsg, setGenMsg] = useState<{ text: string; type: 'success' | 'error'; result?: { generated: number; skipped: number } } | null>(null);

  const loadTrips = useCallback((status: string, date: string, p: number, silent = false) => {
    if (!silent) setLoading(true);
    setPageError('');
    tripService.adminList({ status: status || undefined, date: date || undefined, page: p }).then((res) => {
      if (res.data) {
        setTrips(res.data.trips ?? []);
        setMeta(res.data.meta ?? null);
        setLastUpdated(new Date());
      } else {
        setPageError(res.error?.message ?? 'Failed to load trips.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadTrips(statusFilter, dateFilter, page); }, [statusFilter, dateFilter, page, loadTrips]);
  useEffect(() => { tripService.adminListDrivers().then((res) => { if (res.data) setDrivers(res.data.drivers ?? []); }); }, []);
  useEffect(() => {
    const id = setInterval(() => loadTrips(statusFilter, dateFilter, page, true), 25_000);
    return () => clearInterval(id);
  }, [statusFilter, dateFilter, page, loadTrips]);

  const submitAssign = async (tripId: string) => {
    if (!selectedDriverId) { setAssignMsg({ text: 'Please select a driver.', type: 'error' }); return; }
    setAssigning(true);
    setAssignMsg(null);
    const res = await tripService.adminAssignDriver(tripId, selectedDriverId);
    setAssigning(false);
    if (res.data) {
      setAssignMsg({ text: 'Driver assigned successfully.', type: 'success' });
      setAssigningTripId(null);
      loadTrips(statusFilter, dateFilter, page);
    } else {
      setAssignMsg({ text: res.error?.message ?? 'Assignment failed.', type: 'error' });
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg(null);
    const res = await tripService.adminGenerateTrips(genStartDate || undefined, genEndDate || undefined);
    setGenerating(false);
    if (res.data) {
      setGenMsg({ text: 'Trip generation complete.', type: 'success', result: { generated: res.data.generated ?? 0, skipped: res.data.skipped ?? 0 } });
      loadTrips(statusFilter, dateFilter, page);
    } else {
      setGenMsg({ text: res.error?.message ?? 'Generation failed.', type: 'error' });
    }
  };

  const handleLateCheck = async () => {
    await tripService.adminCheckLate();
    loadTrips(statusFilter, dateFilter, page);
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Trip Operations"
        subtitle="Command center for daily trip monitoring and dispatch"
        lastUpdated={lastUpdated?.toLocaleTimeString()}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => loadTrips(statusFilter, dateFilter, page)} className="min-h-[44px]">
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

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 shadow-card">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Generate trips</h3>
        <p className="text-xs text-gray-500 mb-3">Creates trips from active subscriptions. Idempotent — safe to run multiple times.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Start</label>
            <input type="date" className="input text-sm h-11 min-h-[44px]" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">End</label>
            <input type="date" className="input text-sm h-11 min-h-[44px]" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)} />
          </div>
          <Button variant="primary" size="sm" loading={generating} onClick={handleGenerate} className="min-h-[44px]">
            Generate trips
          </Button>
        </div>
        {genMsg && (
          <Alert variant={genMsg.type} className="mt-3" onClose={() => setGenMsg(null)}>
            {genMsg.text}
            {genMsg.result && <span className="ml-2 font-semibold">{genMsg.result.generated} created · {genMsg.result.skipped} skipped</span>}
          </Alert>
        )}
      </div>

      {viewMode === 'board' && <TripOperationsBoard date={dateFilter} onDateChange={setDateFilter} />}

      {viewMode === 'list' && (
        <>
          <AdminToolbar
            filters={[
              {
                id: 'trip-date',
                label: 'Date',
                element: (
                  <input id="trip-date" type="date" className="input text-sm h-11 w-full min-h-[44px]" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} />
                ),
              },
              {
                id: 'trip-status',
                label: 'Status',
                element: (
                  <AdminFilterSelect
                    id="trip-status"
                    value={statusFilter}
                    onChange={(v) => { setStatusFilter(v); setPage(1); }}
                    options={TRIP_STATUS_FILTERS.map((s) => ({ value: s, label: s ? getDisplayLabel(s as TripStatus) : 'All statuses' }))}
                  />
                ),
              },
            ]}
          />

          {assignMsg && !assigningTripId && (
            <Alert variant={assignMsg.type} className="mb-4" onClose={() => setAssignMsg(null)}>{assignMsg.text}</Alert>
          )}

          {loading ? (
            <AdminSectionLoading message="Loading trips…" />
          ) : pageError ? (
            <ErrorState message={pageError} onRetry={() => loadTrips(statusFilter, dateFilter, page)} />
          ) : trips.length === 0 ? (
            <AdminEmptyState icon={Calendar} title="No trips found" description="No trips match the selected filters." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {trips.map((trip) => {
                const isAssigning = assigningTripId === trip.id;
                const mapsUrl = tripToGoogleMapsUrl(trip);
                return (
                  <AdminDataCard
                    key={trip.id}
                    title={trip.rider?.name ?? 'Trip'}
                    subtitle={`${fmtTime(trip.scheduledPickupTime)} · ${new Date(trip.scheduledDate).toLocaleDateString()}`}
                    badges={<AdminStatusBadge status={trip.status} label={getDisplayLabel(trip.status)} />}
                    metadata={
                      <>
                        <AdminMetaItem label="Pickup" value={trip.pickupLocation} />
                        <AdminMetaItem label="Dropoff" value={trip.dropoffLocation} />
                        <AdminMetaItem label="Driver" value={trip.driver?.profile?.fullName ?? 'Unassigned'} />
                        {!trip.driver && (
                          <span className="col-span-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">Needs driver assignment</span>
                        )}
                      </>
                    }
                    compact
                    actions={
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <MapPin className="h-4 w-4" aria-hidden />
                      </a>
                    }
                  >
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(trip.status === 'SCHEDULED' || trip.status === 'DRIVER_ASSIGNED') && (
                        <Button variant="outline" size="sm" onClick={() => { setAssigningTripId(isAssigning ? null : trip.id); setSelectedDriverId(''); }} className="min-h-[44px]">
                          {isAssigning ? 'Cancel' : trip.driver ? 'Reassign' : 'Assign driver'}
                        </Button>
                      )}
                      {trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED' && (
                        <a href={`/tracking/${trip.id}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="min-h-[44px]">Track</Button>
                        </a>
                      )}
                    </div>
                    {isAssigning && (
                      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                        <select className="input text-sm w-full min-h-[44px]" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}>
                          <option value="">Select a driver…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.profile?.fullName ?? 'Driver'}
                              {d.vehicle ? ` — ${d.vehicle.model} (${d.vehicle.plateNumber})` : ''}
                            </option>
                          ))}
                        </select>
                        <Button variant="primary" size="sm" loading={assigning} onClick={() => submitAssign(trip.id)} className="min-h-[44px]">
                          Confirm assignment
                        </Button>
                      </div>
                    )}
                  </AdminDataCard>
                );
              })}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
          )}
        </>
      )}
    </div>
  );
}
