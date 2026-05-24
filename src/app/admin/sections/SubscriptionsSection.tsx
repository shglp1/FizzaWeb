'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminSubscriptionService } from '@/services/adminService';
import {
  Card, Badge, StatusBadge, Button, Alert, Textarea,
  LoadingState, ErrorState, EmptyState, Pagination,
} from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Variant maps ─────────────────────────────────────────────────────────────

const SUB_VARIANT: Record<string, 'warning' | 'success' | 'info' | 'gray' | 'danger'> = {
  PENDING: 'warning', ACTIVE: 'success', PAUSED: 'info', EXPIRED: 'gray', CANCELLED: 'danger',
};
const PAY_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'gray'> = {
  PENDING: 'warning', PAID: 'success', FAILED: 'danger', REFUNDED: 'gray',
};

// ─── Driver availability badge ────────────────────────────────────────────────

function DriverAvailabilityBadge({ driver }: { driver: AvailableDriver }) {
  if (driver.isCurrentlyAssigned) {
    return <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Currently assigned</span>;
  }
  if (!driver.availability) {
    return <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Unavailable</span>;
  }
  if (driver.hasScheduleConflict) {
    return (
      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        Schedule conflict
      </span>
    );
  }
  return <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Available</span>;
}

// ─── Assign Driver panel ──────────────────────────────────────────────────────

interface AssignDriverPanelProps {
  subscriptionId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function AssignDriverPanel({ subscriptionId, onSuccess, onClose }: AssignDriverPanelProps) {
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    adminSubscriptionService.listAvailableDrivers(subscriptionId).then((res) => {
      if (res.data) {
        setDrivers(res.data as AvailableDriver[]);
      } else {
        setLoadError(res.error?.message ?? 'Failed to load drivers.');
      }
      setLoading(false);
    });
  }, [subscriptionId]);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;

  const handleSubmit = async () => {
    if (!selectedDriverId) {
      setSubmitMsg({ text: 'Please select a driver.', type: 'error' });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    const res = await adminSubscriptionService.assignDriver(subscriptionId, {
      driverId: selectedDriverId,
      effectiveFrom: effectiveFrom || undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.data) {
      setSubmitMsg({ text: 'Driver assigned. Future trips will inherit this driver.', type: 'success' });
      setTimeout(() => { onSuccess(); }, 1200);
    } else {
      setSubmitMsg({ text: res.error?.message ?? 'Assignment failed.', type: 'error' });
    }
  };

  if (loading) return <div className="py-4 text-center text-sm text-gray-500 animate-pulse">Loading drivers…</div>;
  if (loadError) return <p className="text-sm text-red-600 py-2">{loadError}</p>;

  const available = drivers.filter((d) => d.availability && !d.hasScheduleConflict);
  const conflicted = drivers.filter((d) => d.availability && d.hasScheduleConflict);
  const unavailable = drivers.filter((d) => !d.availability);

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      {submitMsg && (
        <Alert variant={submitMsg.type} onClose={() => setSubmitMsg(null)}>{submitMsg.text}</Alert>
      )}

      {/* Driver list */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Select driver</p>

        {/* Note about conflict detection limitation */}
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          Note: Conflict detection is based on shared <strong>weekdays</strong> only. Travel-time buffering between
          back-to-back subscriptions is not yet implemented — verify departure times manually.
        </p>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {drivers.length === 0 && (
            <p className="text-sm text-gray-400 py-2 text-center">No drivers available.</p>
          )}

          {[
            { label: null, list: available },
            { label: 'Schedule conflict', list: conflicted },
            { label: '✕ Unavailable', list: unavailable },
          ].map(({ label, list }) =>
            list.length > 0 ? (
              <div key={label ?? 'available'}>
                {label && <p className="text-xs text-gray-400 uppercase tracking-wide px-1 mb-1">{label}</p>}
                {list.map((d) => {
                  const isSelected = selectedDriverId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDriverId(isSelected ? '' : d.id)}
                      disabled={!d.availability}
                      className={[
                        'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all mb-1.5',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50'
                          : d.availability
                          ? 'border-gray-200 hover:border-emerald-300 bg-white'
                          : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {/* Avatar */}
                      <div className={[
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                        isSelected ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600',
                      ].join(' ')}>
                        {d.fullName[0] ?? 'D'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.fullName}</p>
                          <DriverAvailabilityBadge driver={d} />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                          {d.vehicle && <span>{d.vehicle.model} · <span className="font-mono">{d.vehicle.plateNumber}</span></span>}
                          {d.rating !== null && <span>Rating {d.rating.toFixed(1)}</span>}
                          {d.activeSubscriptionCount > 0 && (
                            <span>{d.activeSubscriptionCount} active sub{d.activeSubscriptionCount !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        {d.hasScheduleConflict && (
                          <p className="text-xs text-amber-700 mt-0.5">
                            Shares weekday(s) with {d.activeSubscriptionCount} other subscription{d.activeSubscriptionCount !== 1 ? 's' : ''}.
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* Effective from */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Effective from <span className="font-normal text-gray-400">(optional — defaults to today)</span>
        </label>
        <input
          type="date"
          className="input text-sm h-9 w-full"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes <span className="font-normal text-gray-400">(optional)</span></label>
        <Textarea
          rows={2}
          placeholder="e.g. Driver preferred by family, covering for Ahmed…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Conflict summary for selected driver */}
      {selectedDriver?.hasScheduleConflict && (
        <Alert variant="warning">
          This driver has a weekday schedule overlap with {selectedDriver.activeSubscriptionCount} other
          subscription{selectedDriver.activeSubscriptionCount !== 1 ? 's' : ''}. Make sure departure
          times don&apos;t clash before confirming.
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={submitting}
          onClick={handleSubmit}
          disabled={!selectedDriverId}
        >
          Confirm Assignment
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function SubscriptionsSection() {
  const [subs, setSubs]     = useState<SubRow[]>([]);
  const [meta, setMeta]     = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [page, setPage]     = useState(1);

  // Cancel state
  const [cancelId, setCancelId]         = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling]     = useState(false);
  const [cancelMsg, setCancelMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Assign-driver panel state
  const [assigningSubId, setAssigningSubId] = useState<string | null>(null);

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

  const submitCancel = async (id: string) => {
    if (!cancelReason.trim()) { setCancelMsg({ text: 'Cancellation reason is required.', type: 'error' }); return; }
    setCancelling(true); setCancelMsg(null);
    const res = await adminSubscriptionService.cancel(id, cancelReason.trim());
    setCancelling(false);
    if (res.data) {
      setCancelMsg({ text: 'Subscription cancelled.', type: 'success' });
      setCancelId(null);
      load(statusFilter, payStatusFilter, page);
    } else {
      setCancelMsg({ text: res.error?.message ?? 'Cancel failed.', type: 'error' });
    }
  };

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Subscriptions</h2>

      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input text-sm h-10" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {['PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input text-sm h-10" value={payStatusFilter} onChange={(e) => { setPayStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Payment Statuses</option>
          {['PENDING', 'PAID', 'FAILED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {cancelMsg && !cancelId && (
        <Alert variant={cancelMsg.type} className="mb-4" onClose={() => setCancelMsg(null)}>{cancelMsg.text}</Alert>
      )}

      {loading ? (
        <LoadingState message="Loading subscriptions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(statusFilter, payStatusFilter, page)} />
      ) : subs.length === 0 ? (
        <EmptyState icon="clipboard" title="No subscriptions found" description="No subscriptions match your filters." />
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            const isCancelling = cancelId === sub.id;
            const isAssigning  = assigningSubId === sub.id;

            const riders = sub.subscriptionRiders.length > 0
              ? sub.subscriptionRiders.map((sr) => sr.rider.name).join(', ')
              : sub.rider?.name ?? '—';

            return (
              <Card key={sub.id}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">
                      {sub.subscriptionType.toLowerCase()} · {sub.package?.name ?? 'No Package'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{sub.user.fullName} · {sub.user.user.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Riders: {riders}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge variant={SUB_VARIANT[sub.status] ?? 'gray'}>{sub.status}</StatusBadge>
                    <Badge variant={PAY_VARIANT[sub.paymentStatus] ?? 'gray'} className="text-[10px]">
                      {sub.paymentStatus}
                    </Badge>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Final Price</p>
                    <p className="font-semibold text-gray-900">SAR {Number(sub.finalPriceSar).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Rides</p>
                    <p className="text-gray-700">{sub.ridesUsed} / {sub._count.trips}</p>
                  </div>
                  {sub.daysLeft !== null && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Days Left</p>
                      <p className={sub.daysLeft <= 7 ? 'text-amber-600 font-semibold' : 'text-gray-700'}>{sub.daysLeft}d</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Auto Renewal</p>
                    <p className="text-gray-700">{sub.autoRenewal ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {/* Assigned driver chip */}
                {sub.assignedDriver ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl mb-3 text-sm">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {sub.assignedDriver.profile?.fullName?.[0] ?? 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        Driver: {sub.assignedDriver.profile?.fullName ?? '—'}
                      </p>
                      {sub.assignedDriver.vehicle && (
                        <p className="text-xs text-gray-500">
                          {sub.assignedDriver.vehicle.model} · <span className="font-mono">{sub.assignedDriver.vehicle.plateNumber}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-emerald-700 shrink-0">Assigned</span>
                  </div>
                ) : sub.status === 'ACTIVE' ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl mb-3">
                    <p className="text-xs text-amber-700">No driver assigned — future trips will be unassigned.</p>
                  </div>
                ) : null}

                {sub.cancellationReason && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">
                    Cancelled: {sub.cancellationReason}
                  </p>
                )}

                {/* Action buttons */}
                {sub.status !== 'CANCELLED' && (
                  <div className="flex flex-wrap gap-2">
                    {/* Assign/Reassign Driver */}
                    {(sub.status === 'ACTIVE' || sub.status === 'PENDING') && (
                      <Button
                        variant={isAssigning ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setAssigningSubId(isAssigning ? null : sub.id);
                          setCancelId(null);
                        }}
                      >
                        {isAssigning ? 'Close' : sub.assignedDriver ? 'Reassign Driver' : 'Assign Driver'}
                      </Button>
                    )}

                    {/* Cancel */}
                    <Button
                      variant={isCancelling ? 'ghost' : 'danger-outline'}
                      size="sm"
                      onClick={() => {
                        setCancelId(isCancelling ? null : sub.id);
                        setCancelReason('');
                        setCancelMsg(null);
                        setAssigningSubId(null);
                      }}
                    >
                      {isCancelling ? 'Cancel Action' : 'Cancel Subscription'}
                    </Button>
                  </div>
                )}

                {/* Assign driver panel */}
                {isAssigning && (
                  <AssignDriverPanel
                    subscriptionId={sub.id}
                    onSuccess={() => { setAssigningSubId(null); load(statusFilter, payStatusFilter, page); }}
                    onClose={() => setAssigningSubId(null)}
                  />
                )}

                {/* Cancel panel */}
                {isCancelling && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    {cancelMsg?.type === 'error' && (
                      <Alert variant="error" onClose={() => setCancelMsg(null)}>{cancelMsg.text}</Alert>
                    )}
                    <Textarea
                      rows={2}
                      placeholder="Cancellation reason (required)…"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" loading={cancelling} onClick={() => submitCancel(sub.id)}>
                        Confirm Cancel
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelId(null)}>Back</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
      )}
    </>
  );
}
