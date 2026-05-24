'use client';

import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, CreditCard, UserX, Clock } from 'lucide-react';
import { adminSubscriptionService } from '@/services/adminService';
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
import { formatSar } from '@/lib/ui/adminCurrency';

type AssignedDriver = {
  id: string;
  profile: { fullName: string; phone: string | null } | null;
  vehicle: { model: string; plateNumber: string } | null;
};

type AvailableDriver = {
  id: string;
  fullName: string;
  phone: string | null;
  availability: boolean;
  rating: number | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  isCurrentlyAssigned: boolean;
  hasScheduleConflict: boolean;
  activeSubscriptionCount: number;
};

type SubRow = {
  id: string;
  subscriptionType: string;
  status: string;
  paymentStatus: string;
  autoRenewal: boolean;
  startsOn: string | null;
  endsOn: string | null;
  finalPriceSar: string;
  cancellationReason: string | null;
  createdAt: string;
  user: { id: string; fullName: string; user: { email: string } };
  rider: { id: string; name: string; school: string | null } | null;
  package: { id: string; name: string; billingCycle: string } | null;
  subscriptionRiders: { rider: { id: string; name: string }; isPrimary: boolean }[];
  assignedDriverId: string | null;
  assignedDriver: AssignedDriver | null;
  ridesUsed: number;
  daysLeft: number | null;
  _count: { trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

const SUB_LABELS: Record<string, string> = {
  PENDING: 'Pending', ACTIVE: 'Active', PAUSED: 'Paused', EXPIRED: 'Expired', CANCELLED: 'Cancelled',
};
const PAY_LABELS: Record<string, string> = {
  PENDING: 'Pending', PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded',
};

function AssignDriverPanel({ subscriptionId, onSuccess, onClose }: { subscriptionId: string; onSuccess: () => void; onClose: () => void }) {
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminSubscriptionService.listAvailableDrivers(subscriptionId).then((res) => {
      if (res.data) setDrivers(res.data as AvailableDriver[]);
      setLoading(false);
    });
  }, [subscriptionId]);

  const handleSubmit = async () => {
    if (!selectedDriverId) { setMsg({ text: 'Select a driver.', type: 'error' }); return; }
    setSubmitting(true);
    const res = await adminSubscriptionService.assignDriver(subscriptionId, { driverId: selectedDriverId });
    setSubmitting(false);
    if (res.data) { onSuccess(); } else { setMsg({ text: res.error?.message ?? 'Failed.', type: 'error' }); }
  };

  if (loading) return <p className="text-sm text-gray-500 animate-pulse py-4">Loading drivers…</p>;

  return (
    <div className="space-y-3">
      {msg && <Alert variant={msg.type}>{msg.text}</Alert>}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {drivers.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedDriverId(d.id)}
            disabled={!d.availability}
            className={`w-full text-left rounded-xl border-2 p-3 min-h-[44px] ${selectedDriverId === d.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100'}`}
          >
            <p className="font-medium text-sm">{d.fullName}</p>
            <p className="text-xs text-gray-500">{d.vehicle?.model} · {d.vehicle?.plateNumber}</p>
            {d.hasScheduleConflict && <p className="text-xs text-amber-700 mt-1">Schedule conflict possible</p>}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit} className="min-h-[44px]">Confirm assignment</Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[44px]">Cancel</Button>
      </div>
    </div>
  );
}

export function SubscriptionsSection() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SubRow | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback((s: string, ps: string, p: number) => {
    setLoading(true);
    setError('');
    adminSubscriptionService.list({ status: s || undefined, paymentStatus: ps || undefined, page: p }).then((res) => {
      if (res.data) {
        setSubs((res.data as { subscriptions: SubRow[]; meta: Meta }).subscriptions ?? []);
        setMeta((res.data as { subscriptions: SubRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load subscriptions.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(statusFilter, payStatusFilter, page); }, [statusFilter, payStatusFilter, page, load]);

  const filtered = driverFilter === 'unassigned'
    ? subs.filter((s) => !s.assignedDriverId && s.status === 'ACTIVE')
    : driverFilter === 'assigned'
    ? subs.filter((s) => !!s.assignedDriverId)
    : subs;

  const kpis = {
    active: subs.filter((s) => s.status === 'ACTIVE').length,
    pendingPay: subs.filter((s) => s.paymentStatus === 'PENDING').length,
    cancelled: subs.filter((s) => s.status === 'CANCELLED').length,
    unassigned: subs.filter((s) => !s.assignedDriverId && s.status === 'ACTIVE').length,
    expiring: subs.filter((s) => s.daysLeft != null && s.daysLeft <= 7 && s.status === 'ACTIVE').length,
  };

  const submitCancel = async (id: string) => {
    if (!cancelReason.trim()) { setActionMsg({ text: 'Reason required.', type: 'error' }); return; }
    setCancelling(true);
    const res = await adminSubscriptionService.cancel(id, cancelReason.trim());
    setCancelling(false);
    if (res.data) {
      setActionMsg({ text: 'Subscription cancelled.', type: 'success' });
      setSelected(null);
      load(statusFilter, payStatusFilter, page);
    } else {
      setActionMsg({ text: res.error?.message ?? 'Failed.', type: 'error' });
    }
  };

  return (
    <div>
      <AdminSectionHeader title="Subscriptions" subtitle="Active plans, payments, and driver assignments" count={meta?.total} countLabel="subscriptions" />

      <AdminMetricGrid
        columns={5}
        items={[
          { label: 'Active', value: kpis.active, color: '#059669' },
          { label: 'Pending Payment', value: kpis.pendingPay, color: '#D97706', icon: CreditCard },
          { label: 'Cancelled', value: kpis.cancelled, color: '#6B7280' },
          { label: 'Unassigned Driver', value: kpis.unassigned, color: '#DC2626', icon: UserX },
          { label: 'Expiring Soon', value: kpis.expiring, color: '#EA580C', icon: Clock },
        ]}
      />

      <AdminToolbar
        filters={[
          { id: 'sub-status', label: 'Status', element: <AdminFilterSelect id="sub-status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[{ value: '', label: 'All' }, ...Object.entries(SUB_LABELS).map(([v, l]) => ({ value: v, label: l }))]} /> },
          { id: 'sub-pay', label: 'Payment', element: <AdminFilterSelect id="sub-pay" value={payStatusFilter} onChange={(v) => { setPayStatusFilter(v); setPage(1); }} options={[{ value: '', label: 'All' }, ...Object.entries(PAY_LABELS).map(([v, l]) => ({ value: v, label: l }))]} /> },
          { id: 'sub-driver', label: 'Driver', element: <AdminFilterSelect id="sub-driver" value={driverFilter} onChange={setDriverFilter} options={[{ value: '', label: 'All' }, { value: 'assigned', label: 'Assigned' }, { value: 'unassigned', label: 'Unassigned' }]} /> },
        ]}
      />

      {actionMsg && !selected && <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>{actionMsg.text}</Alert>}

      {loading ? (
        <AdminSectionLoading message="Loading subscriptions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(statusFilter, payStatusFilter, page)} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={ClipboardList} title="No subscriptions" description="No subscriptions match your filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((sub) => {
            const riders = sub.subscriptionRiders.length > 0
              ? sub.subscriptionRiders.map((sr) => sr.rider.name).join(', ')
              : sub.rider?.name ?? '—';
            return (
              <AdminDataCard
                key={sub.id}
                title={sub.user.fullName}
                subtitle={`${sub.package?.name ?? 'No package'} · ${riders}`}
                badges={<><AdminStatusBadge status={sub.status} label={SUB_LABELS[sub.status]} /><AdminStatusBadge status={sub.paymentStatus} label={PAY_LABELS[sub.paymentStatus]} /></>}
                onClick={() => { setSelected(sub); setAssigning(false); setCancelReason(''); }}
                metadata={
                  <>
                    <AdminMetaItem label="Price" value={formatSar(sub.finalPriceSar)} />
                    <AdminMetaItem label="Driver" value={sub.assignedDriver?.profile?.fullName ?? 'Unassigned'} />
                    <AdminMetaItem label="Trips" value={sub._count.trips} />
                    {sub.daysLeft != null && <AdminMetaItem label="Days left" value={sub.daysLeft} />}
                  </>
                }
                compact
              />
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />}

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.user.fullName ?? ''}
        subtitle={selected?.package?.name}
        width="lg"
      >
        {selected && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <AdminStatusBadge status={selected.status} label={SUB_LABELS[selected.status]} />
              <AdminStatusBadge status={selected.paymentStatus} label={PAY_LABELS[selected.paymentStatus]} />
            </div>

            <AdminDrawerSection title="Subscription">
              <AdminDrawerRow label="Type" value={selected.subscriptionType.replace(/_/g, ' ')} />
              <AdminDrawerRow label="Final price" value={formatSar(selected.finalPriceSar)} />
              <AdminDrawerRow label="Riders" value={selected.subscriptionRiders.map((sr) => sr.rider.name).join(', ') || selected.rider?.name || '—'} />
              <AdminDrawerRow label="Trips generated" value={selected._count.trips} />
              <AdminDrawerRow label="Auto renewal" value={selected.autoRenewal ? 'Yes' : 'No'} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Assigned driver">
              {selected.assignedDriver ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <AdminAvatar name={selected.assignedDriver.profile?.fullName ?? 'D'} />
                    <span className="font-medium">{selected.assignedDriver.profile?.fullName}</span>
                  </div>
                  {selected.assignedDriver.vehicle && (
                    <AdminDrawerRow label="Vehicle" value={`${selected.assignedDriver.vehicle.model} · ${selected.assignedDriver.vehicle.plateNumber}`} />
                  )}
                </>
              ) : (
                <p className="text-sm text-amber-700">No driver assigned — future trips will be unassigned.</p>
              )}
              {selected.status !== 'CANCELLED' && (
                <Button variant="outline" size="sm" onClick={() => setAssigning(!assigning)} className="mt-2 min-h-[44px]">
                  {assigning ? 'Close assignment' : selected.assignedDriver ? 'Reassign driver' : 'Assign driver'}
                </Button>
              )}
              {assigning && (
                <AssignDriverPanel
                  subscriptionId={selected.id}
                  onSuccess={() => { setAssigning(false); setSelected(null); load(statusFilter, payStatusFilter, page); }}
                  onClose={() => setAssigning(false)}
                />
              )}
            </AdminDrawerSection>

            {selected.status !== 'CANCELLED' && (
              <AdminDrawerSection title="Cancel subscription">
                <Textarea rows={2} placeholder="Cancellation reason (required)…" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                <Button variant="danger" size="sm" loading={cancelling} onClick={() => submitCancel(selected.id)} className="mt-2 min-h-[44px]">
                  Confirm cancellation
                </Button>
              </AdminDrawerSection>
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
