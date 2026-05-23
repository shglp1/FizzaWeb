'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminSubscriptionService } from '@/services/adminService';
import {
  Card, Badge, StatusBadge, Button, Alert, Textarea,
  LoadingState, ErrorState, EmptyState, Pagination,
} from '@/components/ui';

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
  ridesUsed: number;
  daysLeft: number | null;
  _count: { trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

const SUB_VARIANT: Record<string, 'warning' | 'success' | 'info' | 'gray' | 'danger'> = {
  PENDING:   'warning',
  ACTIVE:    'success',
  PAUSED:    'info',
  EXPIRED:   'gray',
  CANCELLED: 'danger',
};

const PAY_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'gray'> = {
  PENDING:  'warning',
  PAID:     'success',
  FAILED:   'danger',
  REFUNDED: 'gray',
};

export function SubscriptionsSection() {
  const [subs, setSubs]       = useState<SubRow[]>([]);
  const [meta, setMeta]       = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [page, setPage]       = useState(1);

  const [cancelId, setCancelId]         = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling]     = useState(false);
  const [cancelMsg, setCancelMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
    setCancelling(true);
    setCancelMsg(null);
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
        <EmptyState icon="📋" title="No subscriptions found" description="No subscriptions match your filters." />
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            const isCancelling = cancelId === sub.id;
            const riders = sub.subscriptionRiders.length > 0
              ? sub.subscriptionRiders.map((sr) => sr.rider.name).join(', ')
              : sub.rider?.name ?? '—';

            return (
              <Card key={sub.id}>
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

                {sub.cancellationReason && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">
                    Cancelled: {sub.cancellationReason}
                  </p>
                )}

                {sub.status !== 'CANCELLED' && (
                  <div>
                    <Button
                      variant={isCancelling ? 'ghost' : 'danger-outline'}
                      size="sm"
                      onClick={() => { setCancelId(isCancelling ? null : sub.id); setCancelReason(''); setCancelMsg(null); }}
                    >
                      {isCancelling ? 'Cancel Action' : 'Cancel Subscription'}
                    </Button>

                    {isCancelling && (
                      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                        <Textarea
                          rows={2}
                          placeholder="Cancellation reason (required)…"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          error={cancelMsg?.type === 'error' ? cancelMsg.text : undefined}
                        />
                        <div className="flex gap-2">
                          <Button variant="danger" size="sm" loading={cancelling} onClick={() => submitCancel(sub.id)}>
                            Confirm Cancel
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setCancelId(null)}>Back</Button>
                        </div>
                      </div>
                    )}
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
