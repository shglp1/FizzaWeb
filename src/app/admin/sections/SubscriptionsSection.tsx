'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminSubscriptionService } from '@/services/adminService';

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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: 'Pending',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  ACTIVE:    { label: 'Active',    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  PAUSED:    { label: 'Paused',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  EXPIRED:   { label: 'Expired',   color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-200' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const PAY_CFG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Unpaid',  color: 'text-amber-600' },
  PAID:    { label: 'Paid',    color: 'text-emerald-600' },
  FAILED:  { label: 'Failed',  color: 'text-red-600' },
  REFUNDED:{ label: 'Refunded',color: 'text-gray-500' },
};

export function SubscriptionsSection() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');

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
    if (!cancelReason.trim()) { setCancelMsg('Cancellation reason is required.'); return; }
    setCancelling(true);
    setCancelMsg('');
    const res = await adminSubscriptionService.cancel(id, cancelReason.trim());
    setCancelling(false);
    if (res.data) {
      setCancelMsg('Subscription cancelled.');
      setCancelId(null);
      load(statusFilter, payStatusFilter, page);
    } else {
      setCancelMsg(res.error?.message ?? 'Cancel failed.');
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Subscriptions</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {['PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input text-sm" value={payStatusFilter} onChange={(e) => { setPayStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Payment Statuses</option>
          {['PENDING', 'PAID', 'FAILED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {cancelMsg && !cancelId && (
        <p className={`rounded-xl px-4 py-2 text-sm mb-4 ${cancelMsg.includes('fail') || cancelMsg.includes('required') ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
          {cancelMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading subscriptions…</div>
      ) : error ? (
        <div className="card text-red-600 text-sm">{error}</div>
      ) : subs.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No subscriptions found.</div>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            const sc = STATUS_CFG[sub.status] ?? STATUS_CFG.PENDING;
            const pc = PAY_CFG[sub.paymentStatus] ?? PAY_CFG.PENDING;
            const isCancelling = cancelId === sub.id;

            const riders = sub.subscriptionRiders.length > 0
              ? sub.subscriptionRiders.map((sr) => sr.rider.name).join(', ')
              : sub.rider?.name ?? '—';

            return (
              <div key={sub.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold capitalize">{sub.subscriptionType} · {sub.package?.name ?? 'No Package'}</p>
                    <p className="text-xs text-gray-500">{sub.user.fullName} · {sub.user.user.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Riders: {riders}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.bg} ${sc.color} ${sc.border}`}>
                      {sc.label}
                    </span>
                    <p className={`text-xs mt-1 font-medium ${pc.color}`}>{pc.label}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Final Price</p>
                    <p className="font-semibold">SAR {Number(sub.finalPriceSar).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Rides Used</p>
                    <p>{sub.ridesUsed} / {sub._count.trips}</p>
                  </div>
                  {sub.daysLeft !== null && (
                    <div>
                      <p className="text-xs text-gray-400">Days Left</p>
                      <p className={sub.daysLeft <= 7 ? 'text-amber-600 font-semibold' : ''}>{sub.daysLeft}d</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400">Auto Renewal</p>
                    <p>{sub.autoRenewal ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {sub.status !== 'CANCELLED' && (
                  <div>
                    <button
                      onClick={() => { setCancelId(isCancelling ? null : sub.id); setCancelReason(''); setCancelMsg(''); }}
                      className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        isCancelling ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      {isCancelling ? 'Cancel Action' : 'Cancel Subscription'}
                    </button>

                    {isCancelling && (
                      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                        <textarea
                          rows={2}
                          className="input w-full resize-none text-sm"
                          placeholder="Cancellation reason (required)…"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                        />
                        {cancelMsg && <p className="text-xs text-red-600">{cancelMsg}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => submitCancel(sub.id)} disabled={cancelling} className="btn-primary text-sm px-4 py-2">
                            {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                          </button>
                          <button onClick={() => setCancelId(null)} className="btn-outline text-sm px-4 py-2">Back</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sub.cancellationReason && (
                  <p className="text-xs text-red-600 mt-2">Cancelled: {sub.cancellationReason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} subscriptions)</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}
