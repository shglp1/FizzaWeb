'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Button, LoadingState, Alert, StatusBadge } from '@/components/ui';
import { StatsGrid } from '@/components/ui/enterprise';
import { TripDetailDrawer } from '@/components/admin/TripDetailDrawer';
import { tripService } from '@/services/tripService';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import { classifyTripForBoard } from '@/lib/ui/adminOperations';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { AlertTriangle, Clock } from 'lucide-react';

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

const COLUMN_STYLES = {
  scheduled: 'border-l-4 border-l-blue-400',
  active: 'border-l-4 border-l-emerald-500',
  attention: 'border-l-4 border-l-amber-500',
  completed: 'border-l-4 border-l-gray-300',
};

export function TripOperationsBoard() {
  const [ops, setOps] = useState<OpsData | null>(null);
  const [trips, setTrips] = useState<BoardTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

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

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    tripService.adminGetTrip(selectedId).then((res) => {
      if (res.data) setDetail(res.data as Record<string, unknown>);
    });
  }, [selectedId]);

  if (loading) return <LoadingState message="Loading operations board…" />;
  if (error) return <Alert variant="error">{error}</Alert>;

  const columns = [
    { key: 'scheduled' as const, label: 'Scheduled' },
    { key: 'active' as const, label: 'Active' },
    { key: 'attention' as const, label: 'Needs attention' },
    { key: 'completed' as const, label: 'Completed' },
  ];

  const grouped = columns.map((col) => ({
    ...col,
    trips: trips.filter((t) => classifyTripForBoard(t) === col.key),
  }));

  function fmtTime(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-6 mb-8">
      {ops && (
        <StatsGrid
          columns={7}
          items={[
            { label: 'Today', value: ops.today.total, icon: Clock },
            { label: 'Active', value: ops.today.active, color: '#14A34A' },
            { label: 'Unassigned', value: ops.today.unassigned, color: '#B45309' },
            { label: 'GPS stale', value: ops.today.gpsStale, color: '#DC2626' },
            { label: 'Chat flags', value: ops.today.chatFlagged, color: '#DC2626' },
            { label: 'No show', value: ops.today.noShow },
            { label: 'Completed', value: ops.today.completed, color: '#15803D' },
          ]}
        />
      )}

      {ops && ops.driverWorkload.length > 0 && (
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Driver workload today</p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {ops.driverWorkload.slice(0, 8).map((d) => (
              <div key={d.driverId} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <p className="font-semibold text-sm text-gray-900">{d.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.tripsToday} trips · {d.completedToday} done</p>
                {d.activeTrip && <p className="text-xs text-emerald-700 mt-1 font-medium">Active now</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {grouped.map((col) => (
          <div key={col.key} className="rounded-2xl bg-gray-50/90 border border-gray-100 p-3 min-h-[240px] flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-sm font-bold text-gray-800">{col.label}</p>
              <span className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
                {col.trips.length}
              </span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[480px] scrollbar-thin pr-0.5">
              {col.trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={[
                    'w-full text-left bg-white border rounded-xl p-3 text-sm hover:shadow-card transition-shadow',
                    COLUMN_STYLES[col.key],
                    selectedId === t.id ? 'ring-2 ring-fizza-secondary border-emerald-200' : 'border-gray-100',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{t.rider?.name ?? 'Rider'}</p>
                    <span className="text-xs text-gray-500 shrink-0">{fmtTime(t.scheduledPickupTime)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{t.pickupLocation}</p>
                  <p className="text-xs text-gray-400 truncate">→ {t.dropoffLocation}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <StatusBadge variant="info" className="text-[10px]">
                      {getDisplayLabel(t.status as TripStatus)}
                    </StatusBadge>
                    {t.driver?.profile?.fullName ? (
                      <span className="text-[10px] text-gray-500">{t.driver.profile.fullName}</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        No driver
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {col.trips.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">No trips in this column</p>
              )}
            </div>
          </div>
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
