'use client';

import { DollarSign, CreditCard, Wallet, TrendingUp, Banknote } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminFinancialService } from '@/services/adminService';
import { ErrorState, Button } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import { paymentsToCsv, downloadCsv } from '@/lib/ui/adminExport';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminTable,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDataCard,
  AdminMetaItem,
  AdminFilterSelect,
  AdminSectionLoading,
  AdminLoadingGrid,
  AdminRevenueFlow,
} from '@/components/admin/AdminUI';
import { formatSar } from '@/lib/ui/adminCurrency';

type Overview = {
  totalRevenueSar: number;
  paidParentRevenueSar: number;
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
  driverPayrollPaidSar: number;
  driverPayrollPaidCount: number;
  driverPayoutsCompletedSar: number;
  driverPayrollApprovedSar: number;
  driverPayrollApprovedCount: number;
  driverPayrollDraftSar: number;
  driverPayrollDraftCount: number;
  driverPlatformFeePaidSar: number;
  driverPlatformFeeApprovedSar: number;
  driverPlatformFeeDraftSar: number;
  driverDeductionsPaidSar: number;
  driverBonusesPaidSar: number;
  driverRetentionPaidSar: number;
  totalPlatformRevenueSar: number;
  totalRecognizedRevenueSar: number;
  estimatedGrossMarginSar: number;
  estimatedGrossMarginPercent: number;
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

type PayMeta = { page: number; limit: number; totalPages: number; total: number };

const PAY_LABELS: Record<string, string> = {
  PAID: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

const PURPOSE_LABELS: Record<string, string> = {
  SUBSCRIPTION: 'Subscription',
  SUBSCRIPTION_PAYMENT: 'Subscription payment',
  WALLET_TOP_UP: 'Wallet top-up',
  TRIP: 'Trip',
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
  const [payLimit, setPayLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [payError, setPayError] = useState('');

  const loadOverview = useCallback((df: string, dt: string) => {
    setOvLoading(true);
    adminFinancialService.overview({ dateFrom: df || undefined, dateTo: dt || undefined }).then((res) => {
      if (res.data) setOverview(res.data as Overview);
      setOvLoading(false);
    });
  }, []);

  const loadPayments = useCallback((s: string, p: number, l: number) => {
    setPayLoading(true);
    setPayError('');
    adminFinancialService.payments({ status: s || undefined, page: p, limit: l }).then((res) => {
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
  useEffect(() => { loadPayments(payStatus, payPage, payLimit); }, [payStatus, payPage, payLimit, loadPayments]);

  const exportPaymentsCsv = () => {
    const rows = payments.map((p) => ({
      user: p.user,
      email: p.user.user.email,
      purpose: PURPOSE_LABELS[p.purpose] ?? p.purpose,
      amountSar: p.amountSar,
      status: p.status,
      createdAt: p.createdAt,
    }));
    downloadCsv(`fizza-payments-page-${payPage}.csv`, paymentsToCsv(rows));
  };

  return (
    <div>
      <AdminSectionHeader
        title="Financial Overview"
        subtitle="Recognized revenue, driver payouts, driver-side retention, and estimated gross margin"
      />

      <AdminToolbar
        filters={[
          {
            id: 'fin-from',
            label: 'From',
            element: (
              <input
                id="fin-from"
                type="date"
                className="input text-sm h-11 w-full min-h-[44px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            ),
          },
          {
            id: 'fin-to',
            label: 'To',
            element: (
              <input
                id="fin-to"
                type="date"
                className="input text-sm h-11 w-full min-h-[44px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            ),
          },
        ]}
        activeChips={[
          ...(dateFrom ? [{ label: `From ${dateFrom}`, onRemove: () => setDateFrom('') }] : []),
          ...(dateTo ? [{ label: `To ${dateTo}`, onRemove: () => setDateTo('') }] : []),
        ]}
        onReset={dateFrom || dateTo ? () => { setDateFrom(''); setDateTo(''); } : undefined}
      />

      {ovLoading ? (
        <AdminLoadingGrid count={11} />
      ) : overview ? (
        <>
          <div className="mb-8 grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <AdminRevenueFlow
                title="Total recognized revenue"
                subtitle="Paid parent transactions plus settled driver-side retention from paid payroll lines. Operating costs are not included."
                rows={[
                  {
                    label: 'Parent paid transactions',
                    value: formatSar(overview.paidParentRevenueSar),
                    tone: 'inflow',
                    helper: 'Includes paid subscription payments, wallet top-ups, and wallet-funded subscription payments. MyFatoorah is only one payment source.',
                  },
                  { label: 'Driver platform fees (paid)', value: formatSar(overview.driverPlatformFeePaidSar), tone: 'inflow', helper: 'Platform fee % retained from driver trip gross on paid payroll lines' },
                  ...(overview.driverDeductionsPaidSar > 0 ? [{ label: 'Driver deductions withheld (paid)', value: formatSar(overview.driverDeductionsPaidSar), tone: 'inflow' as const, helper: 'Admin deductions kept by Fizza on paid payroll lines' }] : []),
                  ...(overview.driverBonusesPaidSar > 0 ? [{ label: 'Driver bonuses paid (paid)', value: `− ${formatSar(overview.driverBonusesPaidSar)}`, tone: 'outflow' as const, helper: 'Bonuses funded by Fizza on paid payroll lines' }] : []),
                ]}
                totalLabel="Total recognized revenue"
                totalValue={formatSar(overview.totalRecognizedRevenueSar)}
                totalHelper="Paid parent transactions + driver-side retention (platform fees + deductions − bonuses)"
                footnote="Date filter applies to parent payments (created) and driver payroll (paid at). Draft and approved payroll are excluded from recognized revenue."
              />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <AdminDataCard title="At a glance" compact>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminMetaItem label="Paid parent transactions" value={overview.paidPaymentsCount} />
                  <AdminMetaItem label="Driver payouts completed" value={formatSar(overview.driverPayoutsCompletedSar)} />
                  <AdminMetaItem label="Driver-side retention (paid)" value={formatSar(overview.driverRetentionPaidSar)} />
                  <AdminMetaItem label="Wallet balances (liability)" value={formatSar(overview.totalWalletBalanceSar)} />
                </div>
                <a href="/admin?section=payroll" className="mt-4 inline-flex text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Open Driver Payroll →
                </a>
              </AdminDataCard>
              <AdminDataCard title="Estimated Platform Margin" compact>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-600">Paid parent revenue</span>
                    <span className="tabular-nums font-medium text-emerald-700">{formatSar(overview.paidParentRevenueSar)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-600">Driver payouts completed</span>
                    <span className="tabular-nums font-medium text-amber-700">{formatSar(overview.driverPayoutsCompletedSar)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-600">Driver-side retention</span>
                    <span className="tabular-nums font-medium text-emerald-700">{formatSar(overview.driverRetentionPaidSar)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-2 flex justify-between gap-3">
                    <span className="font-medium text-gray-800">Estimated gross margin</span>
                    <span className="tabular-nums font-semibold text-indigo-700">{formatSar(overview.estimatedGrossMarginSar)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-600">Estimated gross margin %</span>
                    <span className="tabular-nums font-medium text-indigo-700">{overview.estimatedGrossMarginPercent.toFixed(2)}%</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                  This is an estimated gross margin before payment gateway fees, SMS/API costs, refunds, support, hosting, and other operating expenses.
                </p>
              </AdminDataCard>
            </div>
          </div>

          <AdminSectionHeader title="Parent revenue" subtitle="Money collected from parents — only PAID transactions count as recognized revenue" />
          <AdminMetricGrid
            columns={4}
            items={[
              { label: 'Parent paid transactions', value: formatSar(overview.paidParentRevenueSar), icon: DollarSign, color: '#059669' },
              { label: 'Paid transactions', value: overview.paidPaymentsCount, icon: TrendingUp, color: '#059669' },
              { label: 'Pending revenue', value: formatSar(overview.pendingRevenueSar), color: '#D97706' },
              { label: 'Pending payments', value: overview.pendingPaymentsCount, color: '#D97706' },
              { label: 'Failed payments', value: formatSar(overview.failedPaymentsSar), color: '#DC2626' },
              { label: 'Failed payment count', value: overview.failedPaymentsCount, color: '#DC2626' },
              { label: 'Subscription revenue (paid)', value: formatSar(overview.subscriptionRevenueSar), icon: CreditCard, color: '#6366F1' },
              { label: 'Wallet top-ups (paid)', value: formatSar(overview.walletTopUpRevenueSar), icon: Wallet, color: '#2563EB' },
              { label: 'Wallet balance liability', value: formatSar(overview.totalWalletBalanceSar), icon: Wallet, color: '#7C3AED' },
            ]}
          />
          <p className="text-xs text-gray-500 -mt-4 mb-6">
            Pending and failed payments are not recognized revenue. Wallet top-ups increase parent paid transactions and wallet liability until spent on subscriptions.
          </p>
          <div className="mt-6 mb-2">
            <AdminSectionHeader
              title="Driver-side economics"
              subtitle="Trip gross, platform fees, deductions, and bonuses — settled amounts reflect paid payroll lines only"
            />
          </div>
          <AdminMetricGrid
            columns={4}
            items={[
              { label: 'Platform fees (paid)', value: formatSar(overview.driverPlatformFeePaidSar), icon: Banknote, color: '#059669' },
              { label: 'Deductions withheld (paid)', value: formatSar(overview.driverDeductionsPaidSar), color: '#059669' },
              { label: 'Bonuses paid (paid)', value: formatSar(overview.driverBonusesPaidSar), color: '#D97706' },
              { label: 'Driver-side retention (paid)', value: formatSar(overview.driverRetentionPaidSar), color: '#047857' },
              { label: 'Platform fees (approved)', value: formatSar(overview.driverPlatformFeeApprovedSar), color: '#2563EB' },
              { label: 'Platform fees (draft)', value: formatSar(overview.driverPlatformFeeDraftSar), color: '#D97706' },
            ]}
          />
          <p className="text-xs text-gray-500 -mt-4 mb-4">
            Driver-side retention = platform fees + deductions − bonuses from paid payroll lines. Draft and approved payroll do not affect settled retention totals.
          </p>
          <div className="mt-4 mb-2">
            <AdminSectionHeader title="Driver payouts" subtitle="Net pay to drivers after platform fee — only paid payroll lines count as completed payouts" />
          </div>
          <AdminMetricGrid
            columns={3}
            items={[
              { label: 'Driver payouts completed', value: formatSar(overview.driverPayoutsCompletedSar), icon: Banknote, color: '#047857' },
              { label: 'Approved (awaiting payout)', value: formatSar(overview.driverPayrollApprovedSar), color: '#2563EB' },
              { label: 'Draft payroll', value: formatSar(overview.driverPayrollDraftSar), color: '#D97706' },
            ]}
          />
          <p className="text-xs text-gray-500 -mt-4 mb-6">
            Approved and draft payroll are shown for operational visibility but are excluded from completed payout totals and estimated gross margin.
          </p>
        </>
      ) : null}

      <AdminSectionHeader
        title="Payments"
        subtitle="Recent payment transactions"
        count={payMeta?.total}
        countLabel="payments"
      />

      <AdminToolbar
        filters={[
          {
            id: 'pay-status',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="pay-status"
                value={payStatus}
                onChange={(v) => { setPayStatus(v); setPayPage(1); }}
                options={[
                  { value: '', label: 'All statuses' },
                  ...Object.entries(PAY_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            ),
          },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={payments.length === 0}
            onClick={exportPaymentsCsv}
            title="Exports the currently loaded page of filtered payments"
          >
            Export CSV
          </Button>
        }
      />

      <p className="text-xs text-gray-400 mb-3">
        CSV export includes the current filtered page only ({payments.length} row{payments.length === 1 ? '' : 's'}).
      </p>

      {payLoading ? (
        <AdminSectionLoading message="Loading payments…" />
      ) : payError ? (
        <ErrorState message={payError} onRetry={() => loadPayments(payStatus, payPage, payLimit)} />
      ) : payments.length === 0 ? (
        <AdminEmptyState icon={CreditCard} title="No payments found" description="No payments match your filter." />
      ) : (
        <>
          <AdminTable
            rows={payments}
            columns={[
              {
                key: 'user',
                header: 'User',
                cell: (p) => (
                  <div>
                    <p className="font-medium text-gray-900">{p.user.fullName}</p>
                    <p className="text-xs text-gray-400">{p.user.user.email}</p>
                  </div>
                ),
              },
              {
                key: 'purpose',
                header: 'Purpose',
                cell: (p) => (
                  <span className="text-xs capitalize">
                    {PURPOSE_LABELS[p.purpose] ?? p.purpose.toLowerCase().replace(/_/g, ' ')}
                  </span>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                cell: (p) => <span className="font-semibold tabular-nums">{formatSar(p.amountSar)}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (p) => <AdminStatusBadge status={p.status} label={PAY_LABELS[p.status]} />,
              },
              {
                key: 'date',
                header: 'Date',
                cell: (p) => (
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                ),
              },
            ]}
            mobileCard={(p) => (
              <AdminDataCard
                title={p.user.fullName}
                subtitle={p.user.user.email}
                badges={<AdminStatusBadge status={p.status} label={PAY_LABELS[p.status]} />}
                metadata={
                  <>
                    <AdminMetaItem label="Purpose" value={PURPOSE_LABELS[p.purpose] ?? p.purpose} />
                    <AdminMetaItem label="Amount" value={formatSar(p.amountSar)} />
                    <AdminMetaItem label="Date" value={new Date(p.createdAt).toLocaleDateString()} />
                  </>
                }
                compact
              />
            )}
          />
          {payMeta && (
            <AdminPagination
              meta={payMeta}
              onPageChange={setPayPage}
              onLimitChange={(l) => { setPayLimit(l); setPayPage(1); }}
              className="mt-4"
            />
          )}
        </>
      )}
    </div>
  );
}
