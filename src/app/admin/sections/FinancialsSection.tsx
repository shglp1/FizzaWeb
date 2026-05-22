'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminFinancialService } from '@/services/adminService';

type Overview = {
  totalRevenueSar: number;
  paidPaymentsCount: number;
  pendingRevenueSar: number;
  pendingPaymentsCount: number;
  failedPaymentsSar: number;
  failedPaymentsCount: number;
  walletTopUpRevenueSar: number;
  walletTopUpsCount: number;
  subscriptionRevenueSar: number;
  subscriptionPaymentsCount: number;
  totalWalletBalanceSar: number;
};

type Payment = {
  id: string;
  amountSar: string;
  status: string;
  purpose: string;
  gateway: string | null;
  createdAt: string;
  user: { fullName: string; user: { email: string } };
  subscription: { id: string; subscriptionType: string } | null;
};

type PayMeta = { page: number; totalPages: number; total: number };

const PAY_STATUS_CFG: Record<string, { color: string }> = {
  PAID: { color: 'text-emerald-600' },
  PENDING: { color: 'text-amber-600' },
  FAILED: { color: 'text-red-600' },
  REFUNDED: { color: 'text-gray-500' },
};

export function FinancialsSection() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [payMeta, setPayMeta] = useState<PayMeta | null>(null);
  const [payLoading, setPayLoading] = useState(true);
  const [payStatus, setPayStatus] = useState('');
  const [payPage, setPayPage] = useState(1);
  const [payError, setPayError] = useState('');

  const loadOverview = useCallback((df: string, dt: string) => {
    setOvLoading(true);
    adminFinancialService.overview({ dateFrom: df || undefined, dateTo: dt || undefined }).then((res) => {
      if (res.data) setOverview(res.data as Overview);
      setOvLoading(false);
    });
  }, []);

  const loadPayments = useCallback((s: string, p: number) => {
    setPayLoading(true);
    setPayError('');
    adminFinancialService.payments({ status: s || undefined, page: p }).then((res) => {
      if (res.data) {
        setPayments((res.data as { payments: Payment[]; meta: PayMeta }).payments ?? []);
        setPayMeta((res.data as { payments: Payment[]; meta: PayMeta }).meta ?? null);
      } else {
        setPayError(res.error?.message ?? 'Failed to load payments.');
      }
      setPayLoading(false);
    });
  }, []);

  useEffect(() => { loadOverview(dateFrom, dateTo); }, [dateFrom, dateTo, loadOverview]);
  useEffect(() => { loadPayments(payStatus, payPage); }, [payStatus, payPage, loadPayments]);

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Financial Overview</h2>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" className="input text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" className="input text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-500 hover:text-gray-700 underline self-end pb-2">Clear dates</button>
        )}
      </div>

      {/* KPI cards */}
      {ovLoading ? (
        <div className="flex items-center justify-center h-24 text-gray-400">Loading…</div>
      ) : overview ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Revenue', value: `SAR ${overview.totalRevenueSar.toFixed(2)}`, color: 'text-emerald-700' },
            { label: 'Paid Payments', value: overview.paidPaymentsCount, color: 'text-emerald-600' },
            { label: 'Pending Revenue', value: `SAR ${overview.pendingRevenueSar.toFixed(2)}`, color: 'text-amber-700' },
            { label: 'Pending Payments', value: overview.pendingPaymentsCount, color: 'text-amber-600' },
            { label: 'Failed Payments', value: overview.failedPaymentsCount, color: 'text-red-600' },
            { label: 'Wallet Top-ups', value: `SAR ${overview.walletTopUpRevenueSar.toFixed(2)}`, color: 'text-blue-700' },
            { label: 'Subscription Rev.', value: `SAR ${overview.subscriptionRevenueSar.toFixed(2)}`, color: 'text-indigo-700' },
            { label: 'Total Wallet Balance', value: `SAR ${overview.totalWalletBalanceSar.toFixed(2)}`, color: 'text-purple-700' },
          ].map((k) => (
            <div key={k.label} className="card">
              <p className="text-xs text-gray-400 mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Payments table */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Payments</h3>
        <select className="input text-sm" value={payStatus} onChange={(e) => { setPayStatus(e.target.value); setPayPage(1); }}>
          <option value="">All Statuses</option>
          {['PAID', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {payLoading ? (
        <div className="flex items-center justify-center h-24 text-gray-400">Loading payments…</div>
      ) : payError ? (
        <div className="card text-red-600 text-sm">{payError}</div>
      ) : payments.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">No payments found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Purpose</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((p) => {
                const sc = PAY_STATUS_CFG[p.status] ?? PAY_STATUS_CFG.PENDING;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium">{p.user.fullName}</p>
                      <p className="text-xs text-gray-400">{p.user.user.email}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 capitalize">{p.purpose.toLowerCase().replace('_', ' ')}</td>
                    <td className="py-2.5 pr-4 font-semibold">SAR {Number(p.amountSar).toFixed(2)}</td>
                    <td className={`py-2.5 pr-4 font-medium ${sc.color}`}>{p.status}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payMeta && payMeta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPayPage((p) => Math.max(1, p - 1))} disabled={payPage === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {payMeta.page} of {payMeta.totalPages} ({payMeta.total})</span>
          <button onClick={() => setPayPage((p) => Math.min(payMeta.totalPages, p + 1))} disabled={payPage === payMeta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}
