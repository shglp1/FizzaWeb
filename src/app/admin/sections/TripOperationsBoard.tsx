'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Button, LoadingState, Alert, StatusBadge } from '@/components/ui';
import { tripService } from '@/services/tripService';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
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

type ColumnKey = 'scheduled' | 'active' | 'attention' | 'completed';

const ACTIVE = new Set(['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF']);

function classifyTrip(t: BoardTrip): ColumnKey {
  if (t.status === 'COMPLETED') return 'completed';
  if (ACTIVE.has(t.status)) return 'active';
  if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status) && !t.driver) return 'attention';
  if (['CANCELLED', 'NO_SHOW'].includes(t.status)) return 'attention';
  if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status)) return 'scheduled';
  return 'active';
}

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

  const columns: { key: ColumnKey; label: string }[] = [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'active', label: 'Active' },
    { key: 'attention', label: 'Needs Attention' },
    { key: 'completed', label: 'Completed' },
  ];

  const grouped = columns.map((col) => ({
    ...col,
    trips: trips.filter((t) => classifyTrip(t) === col.key),
  }));

  return (
    <div className="space-y-4 mb-8">
      {ops && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            ['Today', ops.today.total],
            ['Active', ops.today.active],
            ['Unassigned', ops.today.unassigned],
            ['GPS Stale', ops.today.gpsStale],
            ['Chat Flags', ops.today.chatFlagged],
            ['No Show', ops.today.noShow],
            ['Done', ops.today.completed],
          ].map(([label, val]) => (
            <Card key={String(label)} padding="sm" className="text-center">
              <p className="text-xl font-bold">{val as number}</p>
              <p className="text-xs text-gray-500">{String(label)}</p>
            </Card>
          ))}
        </div>
      )}

      {ops && ops.driverWorkload.length > 0 && (
        <Card padding="sm">
          <p className="text-sm font-semibold mb-2">Driver workload</p>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {ops.driverWorkload.slice(0, 8).map((d) => (
              <div key={d.driverId} className="border border-gray-100 rounded-lg p-2">
                <p className="font-medium">{d.fullName}</p>
                <p className="text-gray-500">{d.tripsToday} today · {d.completedToday} done</p>
                {d.activeTrip && <p className="text-emerald-600">Active: {d.activeTrip.status}</p>}
                {d.nextTrip && <p className="text-gray-400">Next: {d.nextTrip.status}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {grouped.map((col) => (
          <div key={col.key} className="bg-gray-50/80 rounded-xl p-3 min-h-[200px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">{col.label}</p>
              <span className="text-xs bg-white border rounded-full px-2 py-0.5">{col.trips.length}</span>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {col.trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left bg-white border rounded-lg p-2 text-xs hover:shadow-sm ${selectedId === t.id ? 'border-fizza-primary ring-1 ring-fizza-primary/30' : 'border-gray-100'}`}
                >
                  <p className="font-semibold text-gray-900">{t.rider?.name ?? 'Rider'}</p>
                  <p className="text-gray-500 truncate">{t.pickupLocation}</p>
                  <StatusBadge variant="info" className="mt-1">
                    {getDisplayLabel(t.status as TripStatus)}
                  </StatusBadge>
                </button>
              ))}
              {col.trips.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No trips</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedId && detail && (
        <Card className="border-fizza-secondary/30">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-semibold">Trip detail drawer</p>
              <p className="text-xs text-gray-500 font-mono">{selectedId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>Close</Button>
          </div>
          <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-64">
            {JSON.stringify(detail, null, 2)}
          </pre>
          <div className="flex gap-2 mt-3 flex-wrap">
            <a href={`/tracking/${selectedId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">View tracking</Button>
            </a>
            <Button variant="ghost" size="sm" onClick={() => tripService.adminCheckLate()}>Run late check</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
