'use client';

import { Car, Star, Clock, AlertTriangle, UserCheck, MessageSquareOff } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminDriverService } from '@/services/adminService';
import { Button, Alert, Textarea, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminFilterSelect,
  AdminSectionLoading,
  AdminAvatar,
} from '@/components/admin/AdminUI';

type ApprovedApplication = {
  id: string;
  vehicleType: string;
  city: string;
  serviceArea: string;
  vehicleModel: string;
  plateNumber: string;
};

type ChatBlock = {
  id: string;
  reason: string;
  active: boolean;
  endsAt: string | null;
  createdAt: string;
};

type DriverRow = {
  id: string;
  availability: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  rating: string | null;
  createdAt: string;
  profile: { id: string; fullName: string; phone: string | null; user: { email: string } } | null;
  vehicle: { model: string; plateNumber: string; color: string | null; capacity: number | null } | null;
  approvedApplication: ApprovedApplication | null;
  activeChatBlock: ChatBlock | null;
  _count: { trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

const VEHICLE_TYPES = ['ECONOMY', 'COMFORT', 'FAMILY', 'VAN', 'BUS', 'PREMIUM'];

export function DriversSection() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [suspendedCount, setSuspendedCount] = useState<number | null>(null);

  const [selected, setSelected] = useState<DriverRow | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'chat-block' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [chatBlockReason, setChatBlockReason] = useState('');
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback((
    sf: string,
    af: string,
    vt: string,
    city: string,
    p: number,
    l: number,
  ) => {
    setLoading(true);
    setError('');
    const isSuspended = sf === 'true' ? true : sf === 'false' ? false : undefined;
    const available = af === 'available' ? true : af === 'unavailable' ? false : undefined;
    adminDriverService.list({
      isSuspended,
      available,
      vehicleType: vt || undefined,
      city: city || undefined,
      page: p,
      limit: l,
    }).then((res) => {
      if (res.data) {
        setDrivers((res.data as { drivers: DriverRow[]; meta: Meta }).drivers ?? []);
        setMeta((res.data as { drivers: DriverRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load drivers.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load(suspendedFilter, availabilityFilter, vehicleTypeFilter, cityFilter, page, limit);
  }, [suspendedFilter, availabilityFilter, vehicleTypeFilter, cityFilter, page, limit, load]);

  useEffect(() => {
    Promise.all([
      adminDriverService.list({ isSuspended: false, page: 1, limit: 1 }),
      adminDriverService.list({ isSuspended: true, page: 1, limit: 1 }),
    ]).then(([active, suspended]) => {
      if (active.data) setActiveCount((active.data as { meta: Meta }).meta.total);
      if (suspended.data) setSuspendedCount((suspended.data as { meta: Meta }).meta.total);
    });
  }, []);

  const availableNow = drivers.filter((d) => d.availability && !d.isSuspended).length;

  const reload = () => load(suspendedFilter, availabilityFilter, vehicleTypeFilter, cityFilter, page, limit);

  const submitAction = async (d: DriverRow) => {
    if (actionType === 'suspend' && !suspendReason.trim()) {
      setActionMsg({ text: 'Suspension reason is required.', type: 'error' });
      return;
    }
    if (actionType === 'chat-block' && !chatBlockReason.trim()) {
      setActionMsg({ text: 'Chat block reason is required.', type: 'error' });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);

    let res;
    if (actionType === 'chat-block') {
      res = await adminDriverService.chatBlock(d.id, { reason: chatBlockReason.trim(), active: true });
    } else {
      res = await adminDriverService.update(d.id, {
        isSuspended: actionType === 'suspend',
        suspensionReason: actionType === 'suspend' ? suspendReason.trim() : undefined,
      });
    }

    setSubmitting(false);
    if (res.data) {
      setActionMsg({
        text: actionType === 'chat-block'
          ? 'Driver chat restricted successfully.'
          : `Driver ${actionType === 'suspend' ? 'suspended' : 'reinstated'} successfully.`,
        type: 'success',
      });
      setActionType(null);
      setSelected(null);
      reload();
    } else {
      setActionMsg({ text: res.error?.message ?? 'Action failed.', type: 'error' });
    }
  };

  const unblockChat = async (blockId: string) => {
    setSubmitting(true);
    const res = await adminDriverService.unblockChat(blockId);
    setSubmitting(false);
    if (res.data) {
      setActionMsg({ text: 'Chat restriction removed.', type: 'success' });
      setSelected(null);
      reload();
    } else {
      setActionMsg({ text: res.error?.message ?? 'Unblock failed.', type: 'error' });
    }
  };

  return (
    <div>
      <AdminSectionHeader
        title="Drivers"
        subtitle="Fleet operations — availability, workload, and compliance"
        count={meta?.total}
        countLabel="drivers"
      />

      <AdminMetricGrid
        columns={5}
        items={[
          { label: 'Active Drivers', value: activeCount ?? '—', icon: UserCheck, color: '#059669' },
          { label: 'Suspended', value: suspendedCount ?? '—', icon: AlertTriangle, color: '#DC2626' },
          { label: 'Available Now', value: availableNow, icon: Car, color: '#2563EB', helper: 'On current page' },
          { label: 'Avg Rating', value: drivers.length ? (drivers.reduce((s, d) => s + (d.rating ? Number(d.rating) : 0), 0) / drivers.filter((d) => d.rating).length || 0).toFixed(1) : '—', icon: Star },
          { label: 'Trips (page)', value: drivers.reduce((s, d) => s + d._count.trips, 0), icon: Clock },
        ]}
      />

      <AdminToolbar
        filters={[
          {
            id: 'driver-status',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="driver-status"
                value={suspendedFilter}
                onChange={(v) => { setSuspendedFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All drivers' },
                  { value: 'false', label: 'Active only' },
                  { value: 'true', label: 'Suspended only' },
                ]}
              />
            ),
          },
          {
            id: 'driver-availability',
            label: 'Availability',
            element: (
              <AdminFilterSelect
                id="driver-availability"
                value={availabilityFilter}
                onChange={(v) => { setAvailabilityFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All' },
                  { value: 'available', label: 'Available' },
                  { value: 'unavailable', label: 'Unavailable' },
                ]}
              />
            ),
          },
          {
            id: 'driver-vehicle-type',
            label: 'Vehicle type',
            element: (
              <AdminFilterSelect
                id="driver-vehicle-type"
                value={vehicleTypeFilter}
                onChange={(v) => { setVehicleTypeFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All types' },
                  ...VEHICLE_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() })),
                ]}
              />
            ),
          },
          {
            id: 'driver-city',
            label: 'City',
            element: (
              <input
                id="driver-city"
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
                placeholder="Filter by city…"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm min-h-[44px] w-full min-w-[140px]"
              />
            ),
          },
        ]}
      />

      {actionMsg && !selected && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>{actionMsg.text}</Alert>
      )}

      {loading ? (
        <AdminSectionLoading message="Loading drivers…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : drivers.length === 0 ? (
        <AdminEmptyState icon={Car} title="No drivers found" description="No drivers match your filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {drivers.map((d) => (
            <AdminDataCard
              key={d.id}
              title={d.profile?.fullName ?? 'Unknown Driver'}
              subtitle={d.profile?.user.email}
              badges={
                <>
                  <AdminStatusBadge status={d.isSuspended ? 'SUSPENDED' : 'ACTIVE'} />
                  {!d.isSuspended && (
                    <AdminStatusBadge status={d.availability ? 'AVAILABLE' : 'UNAVAILABLE'} />
                  )}
                  {d.activeChatBlock && (
                    <AdminStatusBadge status="BLOCKED" label="Chat restricted" />
                  )}
                </>
              }
              onClick={() => { setSelected(d); setActionType(null); setSuspendReason(''); setChatBlockReason(''); }}
              metadata={
                <>
                  <AdminMetaItem label="Vehicle" value={d.vehicle ? `${d.vehicle.model} · ${d.vehicle.plateNumber}` : d.approvedApplication?.vehicleModel ?? '—'} />
                  <AdminMetaItem label="City" value={d.approvedApplication?.city ?? '—'} />
                  <AdminMetaItem label="Type" value={d.approvedApplication?.vehicleType ?? '—'} />
                  <AdminMetaItem label="Total trips" value={d._count.trips} />
                </>
              }
              compact
            />
          ))}
        </div>
      )}

      <AdminPagination
        meta={meta}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        className="mt-5"
      />

      <AdminDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionType(null); }}
        title={selected?.profile?.fullName ?? 'Driver'}
        subtitle={selected?.profile?.phone ?? selected?.profile?.user.email}
        footer={
          selected && !selected.isSuspended ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="danger-outline"
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => setActionType(actionType === 'suspend' ? null : 'suspend')}
              >
                {actionType === 'suspend' ? 'Cancel' : 'Suspend driver'}
              </Button>
              {!selected.activeChatBlock && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-h-[44px]"
                  onClick={() => setActionType(actionType === 'chat-block' ? null : 'chat-block')}
                >
                  {actionType === 'chat-block' ? 'Cancel' : 'Restrict chat'}
                </Button>
              )}
            </div>
          ) : selected?.isSuspended ? (
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              className="w-full min-h-[44px]"
              onClick={() => { setActionType('unsuspend'); submitAction(selected); }}
            >
              Reinstate driver
            </Button>
          ) : null
        }
      >
        {selected && (
          <>
            <div className="flex items-center gap-3">
              <AdminAvatar name={selected.profile?.fullName ?? 'D'} colorClass="bg-indigo-500" />
              <div className="flex flex-wrap gap-1.5">
                <AdminStatusBadge status={selected.isSuspended ? 'SUSPENDED' : 'ACTIVE'} />
                <AdminStatusBadge status={selected.availability ? 'AVAILABLE' : 'UNAVAILABLE'} />
                {selected.activeChatBlock && <AdminStatusBadge status="BLOCKED" label="Chat restricted" />}
              </div>
            </div>

            <AdminDrawerSection title="Profile">
              <AdminDrawerRow label="Email" value={selected.profile?.user.email ?? '—'} />
              <AdminDrawerRow label="Phone" value={selected.profile?.phone ?? '—'} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Vehicle">
              <AdminDrawerRow label="Model" value={selected.vehicle?.model ?? selected.approvedApplication?.vehicleModel ?? '—'} />
              <AdminDrawerRow label="Plate" value={selected.vehicle?.plateNumber ?? selected.approvedApplication?.plateNumber ?? '—'} />
              <AdminDrawerRow label="Color" value={selected.vehicle?.color ?? '—'} />
              <AdminDrawerRow label="Capacity" value={selected.vehicle?.capacity ? `${selected.vehicle.capacity} seats` : '—'} />
              <AdminDrawerRow label="Type" value={selected.approvedApplication?.vehicleType ?? '—'} />
            </AdminDrawerSection>

            {selected.approvedApplication && (
              <AdminDrawerSection title="Application summary">
                <AdminDrawerRow label="City" value={selected.approvedApplication.city} />
                <AdminDrawerRow label="Service area" value={selected.approvedApplication.serviceArea} />
              </AdminDrawerSection>
            )}

            <AdminDrawerSection title="Workload">
              <AdminDrawerRow label="Rating" value={selected.rating ? Number(selected.rating).toFixed(1) : '—'} />
              <AdminDrawerRow label="Total trips" value={selected._count.trips} />
              <AdminDrawerRow label="Member since" value={new Date(selected.createdAt).toLocaleDateString()} />
            </AdminDrawerSection>

            {selected.activeChatBlock && (
              <AdminDrawerSection title="Chat restriction">
                <AdminDrawerRow label="Reason" value={selected.activeChatBlock.reason} />
                <AdminDrawerRow label="Since" value={new Date(selected.activeChatBlock.createdAt).toLocaleString()} />
                <Button
                  variant="outline"
                  size="sm"
                  loading={submitting}
                  className="mt-2 min-h-[44px]"
                  onClick={() => unblockChat(selected.activeChatBlock!.id)}
                >
                  <MessageSquareOff className="h-4 w-4 mr-1.5" aria-hidden />
                  Remove chat restriction
                </Button>
              </AdminDrawerSection>
            )}

            {selected.isSuspended && selected.suspensionReason && (
              <AdminDrawerSection title="Suspension">
                <p className="text-sm text-red-700">{selected.suspensionReason}</p>
              </AdminDrawerSection>
            )}

            {actionType === 'suspend' && (
              <AdminDrawerSection title="Suspend driver">
                <Textarea
                  rows={3}
                  placeholder="Reason for suspension (required)…"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
                {actionMsg?.type === 'error' && <p className="text-sm text-red-600">{actionMsg.text}</p>}
                <Button variant="danger" size="sm" loading={submitting} onClick={() => submitAction(selected)} className="mt-2 min-h-[44px]">
                  Confirm suspension
                </Button>
              </AdminDrawerSection>
            )}

            {actionType === 'chat-block' && (
              <AdminDrawerSection title="Restrict chat">
                <Textarea
                  rows={3}
                  placeholder="Reason for chat restriction (required)…"
                  value={chatBlockReason}
                  onChange={(e) => setChatBlockReason(e.target.value)}
                />
                {actionMsg?.type === 'error' && <p className="text-sm text-red-600">{actionMsg.text}</p>}
                <Button variant="danger-outline" size="sm" loading={submitting} onClick={() => submitAction(selected)} className="mt-2 min-h-[44px]">
                  Confirm chat restriction
                </Button>
              </AdminDrawerSection>
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
