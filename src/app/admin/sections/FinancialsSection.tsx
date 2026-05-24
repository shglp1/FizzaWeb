'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminFinancialService } from '@/services/adminService';
import { Card, Badge, StatCard, LoadingState, ErrorState, EmptyState, Pagination } from '@/components/ui';

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

const PAY_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
  PAID: 'success', PENDING: 'warning', FAILED: 'danger', REFUNDED: 'gray',
};

export function FinancialsSection() {
  const [overview, setOverview]   = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');

  const [payments, setPayments]   = useState<Payment[]>([]);
  const [payMeta, setPayMeta]     = useState<PayMeta | null>(null);
  const [payLoading, setPayLoading] = useState(true);
  const [payStatus, setPayStatus] = useState('');
  const [payPage, setPayPage]     = useState(1);
  const [payError, setPayError]   = useState('');

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
      <h2 className="text-base font-semibold text-gray-900 mb-4">Financial Overview</h2>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" className="input text-sm h-10" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" className="input text-sm h-10" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-500 hover:text-gray-700 underline pb-1">
            Clear dates
          </button>
        )}
      </div>

      {/* KPI cards */}
      {ovLoading ? (
        <LoadingState message="Loading financials…" />
      ) : overview ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Revenue"      value={`SAR ${overview.totalRevenueSar.toLocaleString('en-SA', { minimumFractionDigits: 0 })}`} color="#10B981"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
          <StatCard label="Paid Payments"      value={overview.paidPaymentsCount}     color="#10B981"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>} />
          <StatCard label="Pending Revenue"    value={`SAR ${overview.pendingRevenueSar.toFixed(0)}`} color="#F59E0B"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
          <StatCard label="Pending Payments"   value={overview.pendingPaymentsCount}  color="#F59E0B"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
          <StatCard label="Failed Payments"    value={overview.failedPaymentsCount}   color="#EF4444"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
          <StatCard label="Wallet Top-ups"     value={`SAR ${overview.walletTopUpRevenueSar.toFixed(0)}`} color="#3B82F6"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} />
          <StatCard label="Subscription Rev."  value={`SAR ${overview.subscriptionRevenueSar.toFixed(0)}`} color="#6366F1"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
          <StatCard label="Total Wallet Balance" value={`SAR ${overview.totalWalletBalanceSar.toFixed(0)}`} color="#8B5CF6"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>} />
        </div>
      ) : null}

      {/* Payments list */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Recent Payments</h3>
        <select
          className="input text-sm h-9"
          value={payStatus}
          onChange={(e) => { setPayStatus(e.target.value); setPayPage(1); }}
        >
          <option value="">All Statuses</option>
          {['PAID', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {payLoading ? (
        <LoadingState message="Loading payments…" />
      ) : payError ? (
        <ErrorState message={payError} onRetry={() => loadPayments(payStatus, payPage)} />
      ) : payments.length === 0 ? (
        <EmptyState icon="card" title="No payments found" description="No payments match your filter." />
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Purpose</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="pb-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{p.user.fullName}</p>
                      <p className="text-xs text-gray-400">{p.user.user.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 capitalize text-xs">
                      {p.purpose.toLowerCase().replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-gray-900">
                      SAR {Number(p.amountSar).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={PAY_VARIANT[p.status] ?? 'gray'} className="text-[10px]">{p.status}</Badge>
                    </td>
                    <td className="py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {payMeta && payMeta.totalPages > 1 && (
        <Pagination page={payMeta.page} totalPages={payMeta.totalPages} onPageChange={setPayPage} className="mt-4" />
      )}
    </>
  );
}
