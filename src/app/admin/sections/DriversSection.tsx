'use client';

import { Car, Star, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminDriverService } from '@/services/adminService';
import { Button, Alert, Textarea, Pagination, ErrorState } from '@/components/ui';
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

type DriverRow = {
  id: string;
  availability: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  rating: string | null;
  createdAt: string;
  profile: { id: string; fullName: string; phone: string | null; user: { email: string } } | null;
  vehicle: { model: string; plateNumber: string; color: string | null; capacity: number | null } | null;
  _count: { trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function DriversSection() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [suspendedCount, setSuspendedCount] = useState<number | null>(null);

  const [selected, setSelected] = useState<DriverRow | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback((sf: string, p: number) => {
    setLoading(true);
    setError('');
    const isSuspended = sf === 'true' ? true : sf === 'false' ? false : undefined;
    adminDriverService.list({ isSuspended, page: p }).then((res) => {
      if (res.data) {
        setDrivers((res.data as { drivers: DriverRow[]; meta: Meta }).drivers ?? []);
        setMeta((res.data as { drivers: DriverRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load drivers.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(suspendedFilter, page); }, [suspendedFilter, page, load]);

  useEffect(() => {
    Promise.all([
      adminDriverService.list({ isSuspended: false, page: 1 }),
      adminDriverService.list({ isSuspended: true, page: 1 }),
    ]).then(([active, suspended]) => {
      if (active.data) setActiveCount((active.data as { meta: Meta }).meta.total);
      if (suspended.data) setSuspendedCount((suspended.data as { meta: Meta }).meta.total);
    });
  }, []);

  const filtered = availabilityFilter === 'available'
    ? drivers.filter((d) => d.availability && !d.isSuspended)
    : availabilityFilter === 'unavailable'
    ? drivers.filter((d) => !d.availability && !d.isSuspended)
    : drivers;

  const availableNow = drivers.filter((d) => d.availability && !d.isSuspended).length;

  const submitAction = async (d: DriverRow) => {
    if (actionType === 'suspend' && !suspendReason.trim()) {
      setActionMsg({ text: 'Suspension reason is required.', type: 'error' });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    const res = await adminDriverService.update(d.id, {
      isSuspended: actionType === 'suspend',
      suspensionReason: actionType === 'suspend' ? suspendReason.trim() : undefined,
    });
    setSubmitting(false);
    if (res.data) {
      setActionMsg({ text: `Driver ${actionType === 'suspend' ? 'suspended' : 'reinstated'} successfully.`, type: 'success' });
      setActionType(null);
      setSelected(null);
      load(suspendedFilter, page);
    } else {
      setActionMsg({ text: res.error?.message ?? 'Action failed.', type: 'error' });
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
                onChange={setAvailabilityFilter}
                options={[
                  { value: '', label: 'All' },
                  { value: 'available', label: 'Available' },
                  { value: 'unavailable', label: 'Unavailable' },
                ]}
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
        <ErrorState message={error} onRetry={() => load(suspendedFilter, page)} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={Car} title="No drivers found" description="No drivers match your filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((d) => (
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
                </>
              }
              onClick={() => { setSelected(d); setActionType(null); setSuspendReason(''); }}
              metadata={
                <>
                  <AdminMetaItem label="Vehicle" value={d.vehicle ? `${d.vehicle.model} · ${d.vehicle.plateNumber}` : '—'} />
                  <AdminMetaItem label="Capacity" value={d.vehicle?.capacity ? `${d.vehicle.capacity} seats` : '—'} />
                  <AdminMetaItem label="Rating" value={d.rating ? Number(d.rating).toFixed(1) : '—'} />
                  <AdminMetaItem label="Total trips" value={d._count.trips} />
                </>
              }
              compact
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
      )}

      <AdminDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionType(null); }}
        title={selected?.profile?.fullName ?? 'Driver'}
        subtitle={selected?.profile?.phone ?? selected?.profile?.user.email}
        footer={
          selected && !selected.isSuspended ? (
            <div className="flex gap-2">
              <Button
                variant="danger-outline"
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => setActionType(actionType === 'suspend' ? null : 'suspend')}
              >
                {actionType === 'suspend' ? 'Cancel' : 'Suspend driver'}
              </Button>
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
              </div>
            </div>

            <AdminDrawerSection title="Vehicle">
              <AdminDrawerRow label="Model" value={selected.vehicle?.model ?? '—'} />
              <AdminDrawerRow label="Plate" value={selected.vehicle?.plateNumber ?? '—'} />
              <AdminDrawerRow label="Color" value={selected.vehicle?.color ?? '—'} />
              <AdminDrawerRow label="Capacity" value={selected.vehicle?.capacity ? `${selected.vehicle.capacity} seats` : '—'} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Performance">
              <AdminDrawerRow label="Rating" value={selected.rating ? Number(selected.rating).toFixed(1) : '—'} />
              <AdminDrawerRow label="Total trips" value={selected._count.trips} />
              <AdminDrawerRow label="Member since" value={new Date(selected.createdAt).toLocaleDateString()} />
            </AdminDrawerSection>

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
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
