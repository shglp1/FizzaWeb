'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AppShell,
} from '@/components/layout/AppShell';
import {
  DriverCommandHeader,
  DriverEmptyState,
  DriverErrorState,
  DriverKpiCard,
  DriverLoadingState,
  DriverSectionTitle,
} from '@/components/driver/DriverUI';
import { driverEarningsService, driverPayoutService } from '@/services/payrollService';
import { formatSar } from '@/lib/ui/adminCurrency';
import { Button, Input } from '@/components/ui';
import { Banknote, ChevronLeft, ChevronRight, MapPin, Route, Landmark } from 'lucide-react';

type EarningsData = {
  rules: {
    global: { ratePerKmSar: number; platformFeePercent: number };
    overrides: { ratePerKmSar: number | null; platformFeePercent: number | null } | null;
  };
  currentPeriod: {
    year: number;
    month: number;
    status: string;
    tripCount: number;
    totalBillableKm: number;
    grossSar: number;
    platformFeeSar: number;
    tripNetSar: number;
    deductionsSar: number;
    bonusesSar: number;
    netPaySar: number;
    paidAt: string | null;
    trips: {
      tripId: string;
      scheduledDate: string;
      pickupLocation: string;
      dropoffLocation: string;
      legType: string;
      billableKm: number;
      kmSource: string;
      grossSar: number;
      platformFeeSar: number;
      netSar: number;
    }[];
  } | null;
  recentPeriods: {
    year: number;
    month: number;
    status: string;
    netPaySar: number;
    tripCount: number;
    paidAt: string | null;
  }[];
  ytd: { netPaySar: number; tripCount: number };
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COPY: Record<string, string> = {
  DRAFT: 'Pending admin review',
  APPROVED: 'Approved — payout processing',
  PAID: 'Paid',
};

export default function DriverEarningsPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutHolder, setPayoutHolder] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(({ data: me }) => {
        if (me?.role === 'ADMIN') router.replace('/admin');
        else if (me?.role === 'PARENT') router.replace('/dashboard');
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    driverPayoutService.get().then((res) => {
      const p = res.data as {
        bankAccountHolderName?: string | null;
        bankIban?: string | null;
        supplierStatus?: string;
      } | null;
      if (p) {
        setPayoutHolder(p.bankAccountHolderName ?? '');
        setPayoutIban(p.bankIban ?? '');
        setPayoutStatus(p.supplierStatus ?? null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    driverEarningsService.get({ year, month }).then((res) => {
      if (res.data) setData(res.data as EarningsData);
      else setError(res.error?.message ?? 'Failed to load earnings.');
      setLoading(false);
    }).catch(() => {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    });
  }, [year, month]);

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  };

  const effectiveRate = data?.rules.overrides?.ratePerKmSar ?? data?.rules.global.ratePerKmSar;
  const effectiveFee = data?.rules.overrides?.platformFeePercent ?? data?.rules.global.platformFeePercent;

  const savePayoutProfile = async () => {
    setPayoutSaving(true);
    setPayoutMsg('');
    const res = await driverPayoutService.update({
      bankAccountHolderName: payoutHolder.trim(),
      bankIban: payoutIban.trim().toUpperCase(),
    });
    setPayoutSaving(false);
    if (res.error) setPayoutMsg(res.error.message);
    else {
      setPayoutMsg('Bank details saved. Admin will sync MyFatoorah for automated pay.');
      setPayoutStatus('PENDING');
    }
  };

  return (
    <AppShell>
      <DriverCommandHeader
        title="Earnings"
        subtitle="Trip-based pay from completed routes"
        dateLabel={`${MONTHS[month - 1]} ${year}`}
      />

      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-gray-200">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{MONTHS[month - 1]} {year}</span>
        <button type="button" onClick={() => shiftMonth(1)} className="p-2 rounded-lg border border-gray-200">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="h-4 w-4 text-emerald-700" />
          <DriverSectionTitle title="Payout setup" />
        </div>
        <p className="text-xs text-gray-600 mb-3">
          Add your Saudi bank IBAN to receive automated payouts via MyFatoorah after admin approval.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account holder name</label>
            <Input value={payoutHolder} onChange={(e) => setPayoutHolder(e.target.value)} placeholder="As on bank account" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">IBAN (SA…)</label>
            <Input value={payoutIban} onChange={(e) => setPayoutIban(e.target.value)} placeholder="SA0380000000608010167519" />
          </div>
        </div>
        {payoutStatus && (
          <p className="text-xs text-gray-500 mt-2">Payout status: {payoutStatus.replace(/_/g, ' ')}</p>
        )}
        {payoutMsg && <p className="text-xs mt-2 text-emerald-700">{payoutMsg}</p>}
        <Button className="mt-3" size="sm" loading={payoutSaving} onClick={savePayoutProfile}>
          Save bank details
        </Button>
      </div>

      {loading ? (
        <DriverLoadingState message="Loading earnings…" />
      ) : error ? (
        <DriverErrorState message={error} onRetry={() => window.location.reload()} />
      ) : !data ? (
        <DriverEmptyState icon={Banknote} title="No earnings data" description="Try another month." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <DriverKpiCard label="YTD net pay" value={formatSar(data.ytd.netPaySar)} icon={Banknote} />
            <DriverKpiCard label="YTD trips" value={String(data.ytd.tripCount)} icon={Route} />
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 mb-5 text-sm text-purple-950">
            <p className="font-semibold">Your pay rate</p>
            <p className="mt-0.5 opacity-90">
              SAR {effectiveRate?.toFixed(2)}/km · Platform fee {effectiveFee}%
              {data.rules.overrides ? ' (custom rate applied)' : ''}
            </p>
          </div>

          {!data.currentPeriod ? (
            <DriverEmptyState
              icon={Route}
              title="No payroll for this month"
              description="Completed trips in this period will appear after admin generates payroll."
            />
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <DriverSectionTitle title="Period summary" />
                  <span className="text-xs font-medium text-gray-500">
                    {STATUS_COPY[data.currentPeriod.status] ?? data.currentPeriod.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-gray-500">Trips</dt><dd className="font-semibold">{data.currentPeriod.tripCount}</dd></div>
                  <div><dt className="text-gray-500">Billable km</dt><dd className="font-semibold">{data.currentPeriod.totalBillableKm.toFixed(1)}</dd></div>
                  <div><dt className="text-gray-500">Gross</dt><dd className="font-semibold">{formatSar(data.currentPeriod.grossSar)}</dd></div>
                  <div><dt className="text-gray-500">Platform fee</dt><dd className="font-semibold">{formatSar(data.currentPeriod.platformFeeSar)}</dd></div>
                  {data.currentPeriod.deductionsSar > 0 && (
                    <div><dt className="text-gray-500">Deductions</dt><dd className="font-semibold text-red-600">−{formatSar(data.currentPeriod.deductionsSar)}</dd></div>
                  )}
                  {data.currentPeriod.bonusesSar > 0 && (
                    <div><dt className="text-gray-500">Bonuses</dt><dd className="font-semibold text-emerald-600">+{formatSar(data.currentPeriod.bonusesSar)}</dd></div>
                  )}
                  <div className="col-span-2 pt-2 border-t mt-1">
                    <dt className="text-gray-500">Net pay</dt>
                    <dd className="text-xl font-bold text-emerald-700">{formatSar(data.currentPeriod.netPaySar)}</dd>
                  </div>
                </dl>
                {data.currentPeriod.paidAt && (
                  <p className="text-xs text-emerald-700 mt-3">
                    Paid on {new Date(data.currentPeriod.paidAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="mb-3">
                <DriverSectionTitle title="Trip breakdown" />
              </div>
              <div className="space-y-3">
                {data.currentPeriod.trips.map((t) => (
                  <div key={t.tripId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {new Date(t.scheduledDate).toLocaleDateString()} · {t.legType}
                      </span>
                      <span className="text-sm font-bold text-emerald-700">{formatSar(t.netSar)}</span>
                    </div>
                    <p className="text-xs text-gray-600 flex items-start gap-1 mb-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {t.pickupLocation}
                    </p>
                    <p className="text-xs text-gray-600 flex items-start gap-1 mb-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {t.dropoffLocation}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {t.billableKm.toFixed(1)} km ({t.kmSource}) · Gross {formatSar(t.grossSar)} · Fee {formatSar(t.platformFeeSar)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.recentPeriods.length > 0 && (
            <>
              <div className="mt-8 mb-3">
                <DriverSectionTitle title="Recent periods" />
              </div>
              <div className="space-y-2">
                {data.recentPeriods.map((p) => (
                  <button
                    key={`${p.year}-${p.month}`}
                    type="button"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm hover:border-emerald-200"
                    onClick={() => { setYear(p.year); setMonth(p.month); }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{MONTHS[p.month - 1]} {p.year}</span>
                      <span className="text-sm font-semibold text-emerald-700">{formatSar(p.netPaySar)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.tripCount} trips · {STATUS_COPY[p.status] ?? p.status}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="text-xs text-gray-500 mt-6 text-center">
            Questions about pay? Contact support via{' '}
            <Link href="/profile" className="text-emerald-700 underline">Profile</Link>.
          </p>
        </>
      )}
    </AppShell>
  );
}
