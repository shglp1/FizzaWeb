'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Clock, MessageSquare, Navigation, RefreshCw, UserX, Users,
} from 'lucide-react';
import Link from 'next/link';
import { Button, Alert, StatusBadge } from '@/components/ui';
import { TripDetailDrawer } from '@/components/admin/TripDetailDrawer';
import { TripAssignDriverModal } from '@/components/admin/TripAssignDriverModal';
import {
  AdminMetricGrid,
  AdminTabs,
  AdminEmptyState,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';
import { tripService } from '@/services/tripService';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import { classifyTripForBoard } from '@/lib/ui/adminOperations';
import { normalizeAdminTripDetail, type NormalizedAdminTripDetail } from '@/lib/ui/adminTripDetail';
import {
  formatDispatchNoteSummary,
  formatLegType,
  formatRouteSummary,
  formatTripDateTime,
  getPrimaryTripAction,
  getTripCardBadges,
} from '@/lib/ui/adminTrips';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

type OpsData = {
  today: {
    total: number; active: number; unassigned: number; needsDispatch: number;
    completed: number; cancelled: number; noShow: number; gpsStale: number; chatFlagged: number;
  };
  driverWorkload: {
    driverId: string; fullName: string; tripsToday: number;
    activeTrip: { id: string; status: string } | null;
    nextTrip: { id: string; status: string } | null;
    completedToday: number;
  }[];
};

export type BoardTrip = {
  id: string;
  status: string;
  needsDispatch?: boolean;
  dispatchNote?: string | null;
  legType?: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { name: string } | null;
  driver: { profile: { fullName: string } | null } | null;
  subscription?: { user?: { fullName: string } | null } | null;
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
  onRefresh,
  refreshToken = 0,
}: {
  date?: string;
  onDateChange?: (d: string) => void;
  onRefresh?: () => void;
  refreshToken?: number;
}) {
  const [ops, setOps] = useState<OpsData | null>(null);
  const [trips, setTrips] = useState<BoardTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NormalizedAdminTripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [error, setError] = useState('');
  const [mobileColumn, setMobileColumn] = useState('scheduled');
  const [assignTrip, setAssignTrip] = useState<BoardTrip | null>(null);
  const [assignMode, setAssignMode] = useState<'assign' | 'reassign'>('assign');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const today = date ?? new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setError('');
    const [opsRes, tripsRes] = await Promise.all([
      tripService.adminOperations(),
      tripService.adminList({ date: today, page: 1, limit: 100 }),
    ]);
    if (opsRes.data) setOps(opsRes.data as OpsData);
    else setError(opsRes.error?.message ?? 'Failed to load operations');
    if (tripsRes.data?.trips) setTrips(tripsRes.data.trips as BoardTrip[]);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, refreshToken]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError('');
      return;
    }
    setDetailLoading(true);
    setDetailError('');
    tripService.adminGetTrip(selectedId).then((res) => {
      if (res.data?.trip) setDetail(normalizeAdminTripDetail(res.data));
      else {
        setDetail(null);
        setDetailError(res.error?.message ?? 'Failed to load trip details.');
      }
      setDetailLoading(false);
    }).catch(() => {
      setDetail(null);
      setDetailError('Failed to load trip details.');
      setDetailLoading(false);
    });
  }, [selectedId]);

  const openAssign = (trip: BoardTrip, mode: 'assign' | 'reassign') => {
    setAssignTrip(trip);
    setAssignMode(mode);
  };

  const handleAssignSuccess = (message: string) => {
    setToast({ text: message, type: 'success' });
    setAssignTrip(null);
    setSelectedId(null);
    load();
    onRefresh?.();
  };

  if (loading) return <AdminSectionLoading message="Loading operations board…" />;
  if (error) return <Alert variant="error">{error} <Button variant="outline" size="sm" onClick={load} className="ml-2 min-h-[44px]">Retry</Button></Alert>;

  const grouped = COLUMNS.map((col) => ({
    ...col,
    trips: trips.filter((t) => classifyTripForBoard(t) === col.key),
  }));

  const scheduledAssigned = trips.filter((t) => t.status === 'DRIVER_ASSIGNED' || (t.status === 'SCHEDULED' && t.driver)).length;

  return (
    <div className="space-y-5 overflow-x-hidden">
      {toast && (
        <Alert variant={toast.type} onClose={() => setToast(null)}>{toast.text}</Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {onDateChange && (
          <div className="w-full sm:w-auto">
            <label htmlFor="board-date" className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Operations date</label>
            <input id="board-date" type="date" className="input text-sm h-11 min-h-[44px] w-full sm:w-auto" value={today} onChange={(e) => onDateChange(e.target.value)} />
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={load} className="min-h-[44px]">
          <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh board
        </Button>
      </div>

      {ops && (
        <AdminMetricGrid
          columns={4}
          items={[
            { label: 'Trips Today', value: ops.today.total, icon: Clock, helper: 'All trips scheduled today' },
            { label: 'Active', value: ops.today.active, color: '#059669', helper: 'In progress now' },
            { label: 'Driver Assigned', value: scheduledAssigned, color: '#2563EB', icon: Users, helper: 'Confirmed on board' },
            { label: 'Unassigned', value: ops.today.unassigned, color: '#D97706', icon: UserX, helper: 'No driver yet' },
            { label: 'Needs Dispatch', value: ops.today.needsDispatch, color: '#DC2626', icon: AlertTriangle, helper: 'Timeline conflict' },
            { label: 'Scheduled', value: trips.filter((t) => classifyTripForBoard(t) === 'scheduled').length, helper: 'Upcoming today' },
            { label: 'GPS Stale', value: ops.today.gpsStale, color: '#9333EA', icon: Navigation, helper: 'Active trips' },
            { label: 'Chat Flags', value: ops.today.chatFlagged, color: '#EA580C', icon: MessageSquare, helper: 'Moderation queue' },
            { label: 'No Show', value: ops.today.noShow, color: '#6B7280', helper: 'Today' },
            { label: 'Completed', value: ops.today.completed, color: '#15803D', helper: 'Finished today' },
          ]}
        />
      )}

      {ops && ops.driverWorkload.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-gray-900 mb-3">Driver workload</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ops.driverWorkload.slice(0, 12).map((d) => (
              <div key={d.driverId} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <p className="font-semibold text-sm text-gray-900 truncate">{d.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.tripsToday} trips · {d.completedToday} done</p>
                {d.activeTrip && <p className="text-xs text-emerald-700 mt-1 font-medium">Active now</p>}
                {!d.activeTrip && d.nextTrip && <p className="text-xs text-gray-500 mt-1">Next trip scheduled</p>}
                {!d.activeTrip && !d.nextTrip && d.tripsToday > 3 && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> High load
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AdminEmptyState icon={Users} title="No driver workload yet" description="Driver snapshots appear when trips are scheduled for today." />
      )}

      <AdminTabs
        tabs={grouped.map((c) => ({ label: c.label, value: c.key, count: c.trips.length }))}
        active={mobileColumn}
        onChange={setMobileColumn}
      />

      <div className="hidden xl:grid xl:grid-cols-4 gap-4 min-w-0">
        {grouped.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAssign={openAssign}
          />
        ))}
      </div>

      <div className="xl:hidden min-w-0">
        {grouped.filter((c) => c.key === mobileColumn).map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAssign={openAssign}
            mobile
          />
        ))}
      </div>

      {selectedId && detailLoading && (
        <AdminSectionLoading message="Loading trip details…" />
      )}
      {selectedId && detailError && (
        <Alert variant="error">{detailError}</Alert>
      )}
      {selectedId && detail && !detailLoading && (
        <TripDetailDrawer
          open={!!selectedId}
          tripId={selectedId}
          detail={detail}
          onClose={() => setSelectedId(null)}
          onAssign={() => {
            const t = trips.find((x) => x.id === selectedId);
            if (t) openAssign(t, 'assign');
          }}
          onReassign={() => {
            const t = trips.find((x) => x.id === selectedId);
            if (t) openAssign(t, 'reassign');
          }}
        />
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
          onSuccess={handleAssignSuccess}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  col,
  selectedId,
  onSelect,
  onAssign,
  mobile,
}: {
  col: { key: string; label: string; trips: BoardTrip[] };
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAssign: (trip: BoardTrip, mode: 'assign' | 'reassign') => void;
  mobile?: boolean;
}) {
  const borderColors: Record<string, string> = {
    scheduled: 'border-l-blue-400',
    active: 'border-l-emerald-500',
    attention: 'border-l-amber-500',
    completed: 'border-l-gray-300',
  };

  return (
    <div className={`rounded-2xl bg-gray-50/90 border border-gray-100 p-3 min-h-[200px] flex flex-col min-w-0 ${mobile ? '' : ''}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-sm font-bold text-gray-800">{col.label}</p>
        <span className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-2.5 py-0.5">{col.trips.length}</span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto max-h-[520px] scrollbar-thin">
        {col.trips.map((t) => (
          <TripBoardCard
            key={t.id}
            trip={t}
            columnKey={col.key}
            selected={selectedId === t.id}
            borderClass={borderColors[col.key] ?? 'border-l-gray-300'}
            onSelect={() => onSelect(t.id)}
            onAssign={(mode) => onAssign(t, mode)}
          />
        ))}
        {col.trips.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            {col.key === 'attention' ? 'No items need attention' : 'No trips'}
          </p>
        )}
      </div>
    </div>
  );
}

function TripBoardCard({
  trip: t,
  columnKey,
  selected,
  borderClass,
  onSelect,
  onAssign,
}: {
  trip: BoardTrip;
  columnKey: string;
  selected: boolean;
  borderClass: string;
  onSelect: () => void;
  onAssign: (mode: 'assign' | 'reassign') => void;
}) {
  const badges = getTripCardBadges({ needsDispatch: t.needsDispatch, status: t.status, driver: t.driver });
  const action = getPrimaryTripAction(t);

  return (
    <div
      className={[
        'w-full text-left bg-white border rounded-xl p-3 text-sm border-l-4 min-w-0',
        borderClass,
        selected ? 'ring-2 ring-fizza-secondary border-emerald-200' : 'border-gray-100',
      ].join(' ')}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{t.rider?.name ?? 'Rider'}</p>
            <p className="text-[10px] text-gray-400">{formatTripDateTime(t.scheduledDate, t.scheduledPickupTime)}</p>
          </div>
          <span className="text-[10px] font-medium text-gray-500 shrink-0">{formatLegType(t.legType)}</span>
        </div>
        <p className="text-xs text-gray-500 truncate" title={formatRouteSummary(t.pickupLocation, t.dropoffLocation, 120)}>
          {formatRouteSummary(t.pickupLocation, t.dropoffLocation)}
        </p>
        {t.subscription?.user?.fullName && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">Parent: {t.subscription.user.fullName}</p>
        )}
        {t.dispatchNote && (
          <p className="text-xs text-amber-700 mt-1 line-clamp-2" title={t.dispatchNote}>
            {formatDispatchNoteSummary(t.dispatchNote)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <StatusBadge variant="info" className="text-[10px]">{getDisplayLabel(t.status as TripStatus)}</StatusBadge>
          {badges.map((b) => (
            <span key={b.key} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{b.label}</span>
          ))}
          {t.driver?.profile?.fullName ? (
            <span className="text-[10px] text-gray-500 truncate">{t.driver.profile.fullName}</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Unassigned
            </span>
          )}
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-50">
        {(action === 'assign' || columnKey === 'attention') && (
          <Button variant="primary" size="sm" className="min-h-[36px] text-xs" onClick={() => onAssign('assign')}>
            Assign driver
          </Button>
        )}
        {action === 'reassign' && (
          <Button variant="outline" size="sm" className="min-h-[36px] text-xs" onClick={() => onAssign('reassign')}>
            Reassign
          </Button>
        )}
        <Button variant="ghost" size="sm" className="min-h-[36px] text-xs" onClick={onSelect}>Details</Button>
        {action === 'track' && (
          <Link href={`/tracking/${t.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="min-h-[36px] text-xs">Track</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
