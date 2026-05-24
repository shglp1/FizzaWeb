'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Button, Alert, StatusBadge } from '@/components/ui';
import { TripDetailDrawer } from '@/components/admin/TripDetailDrawer';
import {
  AdminMetricGrid,
  AdminTabs,
} from '@/components/admin/AdminUI';
import { tripService } from '@/services/tripService';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import { classifyTripForBoard } from '@/lib/ui/adminOperations';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

type OpsData = {
  today: {
    total: number; active: number; unassigned: number; completed: number;
    cancelled: number; noShow: number; gpsStale: number; chatFlagged: number;
  };
  driverWorkload: {
    driverId: string; fullName: string; tripsToday: number;
    activeTrip: { id: string; status: string } | null;
    nextTrip: { id: string; status: string } | null;
    completedToday: number;
  }[];
};

type BoardTrip = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { name: string } | null;
  driver: { profile: { fullName: string } | null } | null;
};

const COLUMNS = [
  { key: 'scheduled' as const, label: 'Scheduled' },
  { key: 'active' as const, label: 'Active' },
  { key: 'attention' as const, label: 'Needs Attention' },
  { key: 'completed' as const, label: 'Completed' },
];

export function TripOperationsBoard({
  date,
  onDateChange,
}: {
  date?: string;
  onDateChange?: (d: string) => void;
}) {
  const [ops, setOps] = useState<OpsData | null>(null);
  const [trips, setTrips] = useState<BoardTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [mobileColumn, setMobileColumn] = useState('scheduled');

  const today = date ?? new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setError('');
    const [opsRes, tripsRes] = await Promise.all([
      tripService.adminOperations(),
      tripService.adminList({ date: today, page: 1 }),
    ]);
    if (opsRes.data) setOps(opsRes.data as OpsData);
    else setError(opsRes.error?.message ?? 'Failed to load operations');
    if (tripsRes.data?.trips) setTrips(tripsRes.data.trips as BoardTrip[]);
    setLoading(false);
  }, [today]);

  useEffect(() => { setLoading(true); load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    tripService.adminGetTrip(selectedId).then((res) => {
      if (res.data) setDetail(res.data as Record<string, unknown>);
    });
  }, [selectedId]);

  if (loading) return <div className="animate-pulse h-40 rounded-2xl bg-gray-100" />;
  if (error) return <Alert variant="error">{error}</Alert>;

  const grouped = COLUMNS.map((col) => ({
    ...col,
    trips: trips.filter((t) => classifyTripForBoard(t) === col.key),
  }));

  function fmtTime(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const delayed = ops?.today.noShow ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        {onDateChange && (
          <div>
            <label htmlFor="board-date" className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Operations date</label>
            <input id="board-date" type="date" className="input text-sm h-11 min-h-[44px]" value={today} onChange={(e) => onDateChange(e.target.value)} />
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={load} className="min-h-[44px]">
          <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh board
        </Button>
      </div>

      {ops && (
        <AdminMetricGrid
          columns={7}
          items={[
            { label: 'Trips Today', value: ops.today.total, icon: Clock },
            { label: 'Active', value: ops.today.active, color: '#059669' },
            { label: 'Unassigned', value: ops.today.unassigned, color: '#D97706' },
            { label: 'Delayed', value: delayed, color: '#DC2626' },
            { label: 'GPS Stale', value: ops.today.gpsStale, color: '#DC2626' },
            { label: 'Chat Flags', value: ops.today.chatFlagged, color: '#DC2626' },
            { label: 'Completed', value: ops.today.completed, color: '#15803D' },
          ]}
        />
      )}

      {ops && ops.driverWorkload.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-gray-900 mb-3">Driver workload</p>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin">
            {ops.driverWorkload.slice(0, 12).map((d) => (
              <div key={d.driverId} className="snap-start shrink-0 w-[min(100%,200px)] rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <p className="font-semibold text-sm text-gray-900 truncate">{d.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.tripsToday} trips · {d.completedToday} done</p>
                {d.activeTrip && <p className="text-xs text-emerald-700 mt-1 font-medium">Active now</p>}
                {!d.activeTrip && d.nextTrip && <p className="text-xs text-gray-500 mt-1">Next: {d.nextTrip.status}</p>}
                {!d.activeTrip && !d.nextTrip && d.tripsToday > 3 && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> High load
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AdminTabs
        tabs={grouped.map((c) => ({ label: c.label, value: c.key, count: c.trips.length }))}
        active={mobileColumn}
        onChange={setMobileColumn}
      />

      <div className="hidden xl:grid xl:grid-cols-4 gap-4">
        {grouped.map((col) => (
          <KanbanColumn key={col.key} col={col} selectedId={selectedId} onSelect={setSelectedId} fmtTime={fmtTime} />
        ))}
      </div>

      <div className="xl:hidden">
        {grouped.filter((c) => c.key === mobileColumn).map((col) => (
          <KanbanColumn key={col.key} col={col} selectedId={selectedId} onSelect={setSelectedId} fmtTime={fmtTime} mobile />
        ))}
      </div>

      {selectedId && detail && (
        <TripDetailDrawer
          tripId={selectedId}
          detail={detail as Parameters<typeof TripDetailDrawer>[0]['detail']}
          onClose={() => setSelectedId(null)}
          onRunLateCheck={() => void tripService.adminCheckLate()}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  col,
  selectedId,
  onSelect,
  fmtTime,
  mobile,
}: {
  col: { key: string; label: string; trips: BoardTrip[] };
  selectedId: string | null;
  onSelect: (id: string) => void;
  fmtTime: (iso: string | null) => string;
  mobile?: boolean;
}) {
  const borderColors: Record<string, string> = {
    scheduled: 'border-l-blue-400',
    active: 'border-l-emerald-500',
    attention: 'border-l-amber-500',
    completed: 'border-l-gray-300',
  };

  return (
    <div className={`rounded-2xl bg-gray-50/90 border border-gray-100 p-3 min-h-[200px] flex flex-col ${mobile ? '' : ''}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-sm font-bold text-gray-800">{col.label}</p>
        <span className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-2.5 py-0.5">{col.trips.length}</span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto max-h-[480px] scrollbar-thin">
        {col.trips.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={[
              'w-full text-left bg-white border rounded-xl p-3 text-sm hover:shadow-card transition-shadow border-l-4',
              borderColors[col.key] ?? 'border-l-gray-300',
              selectedId === t.id ? 'ring-2 ring-fizza-secondary border-emerald-200' : 'border-gray-100',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-semibold text-gray-900">{t.rider?.name ?? 'Rider'}</p>
              <span className="text-xs text-gray-500 shrink-0">{fmtTime(t.scheduledPickupTime)}</span>
            </div>
            <p className="text-xs text-gray-500 truncate">{t.pickupLocation}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <StatusBadge variant="info" className="text-[10px]">{getDisplayLabel(t.status as TripStatus)}</StatusBadge>
              {t.driver?.profile?.fullName ? (
                <span className="text-[10px] text-gray-500">{t.driver.profile.fullName}</span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
                  <AlertTriangle className="h-3 w-3" aria-hidden /> No driver
                </span>
              )}
            </div>
          </button>
        ))}
        {col.trips.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No trips</p>}
      </div>
    </div>
  );
}
