'use client';

import { Banknote, Calculator, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';
import { downloadCsv } from '@/lib/ui/adminExport';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { payrollService } from '@/services/payrollService';
import { systemConfigService } from '@/services/adminService';
import { Button, Alert, Input, Textarea } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminSectionLoading,
  AdminRevenueFlow,
} from '@/components/admin/AdminUI';
import { formatSar } from '@/lib/ui/adminCurrency';
import { aggregatePeriodEconomics, fizzaRetentionFromDrivers, fizzaRetentionFromDriversPaid } from '@/lib/payroll/platformEconomics';
import { calculatePeriodNetPay } from '@/lib/payroll/calculateTripEarning';

type RunSummary = {
  id: string;
  year: number;
  month: number;
  status: string;
  generatedAt: string;
  lineCount: number;
  totalNetPaySar: number;
  paidCount: number;
  approvedCount: number;
};

type TripEarning = {
  id: string;
  billableKm: string;
  kmSource: string;
  grossSar: string;
  platformFeeSar: string;
  netSar: string;
  trip: {
    id: string;
    scheduledDate: string;
    pickupLocation: string;
    dropoffLocation: string;
    legType: string;
  };
};

type PayrollLine = {
  id: string;
  tripCount: number;
  totalBillableKm: string;
  grossSar: string;
  platformFeeSar: string;
  tripNetSar: string;
  deductionsSar: string;
  bonusesSar: string;
  netPaySar: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  adminNotes: string | null;
  paidAt: string | null;
  payoutMethod?: string | null;
  payoutRef?: string | null;
  payoutError?: string | null;
  driver: {
    profile: { fullName: string; user: { email: string } } | null;
  };
  tripEarnings: TripEarning[];
};

type PayrollRunDetail = {
  id: string;
  year: number;
  month: number;
  skippedTripCount?: number;
  skippedTrips?: { tripId: string; scheduledDate: string; reason: string }[] | null;
  lines: PayrollLine[];
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LINE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PAID: 'Paid',
};

function periodLabel(year: number, month: number) {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

export function PayrollSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runDetail, setRunDetail] = useState<PayrollRunDetail | null>(null);
  const [globalRate, setGlobalRate] = useState('');
  const [globalFee, setGlobalFee] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedLine, setSelectedLine] = useState<PayrollLine | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [editDeductions, setEditDeductions] = useState('');
  const [editBonuses, setEditBonuses] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [lineSubmitting, setLineSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [kmEdits, setKmEdits] = useState<Record<string, string>>({});
  const [kmSavingId, setKmSavingId] = useState<string | null>(null);
  const [skippedKm, setSkippedKm] = useState<Record<string, string>>({});
  const [skippedSavingId, setSkippedSavingId] = useState<string | null>(null);

  const loadRules = useCallback(() => {
    systemConfigService.list().then((res) => {
      if (res.data) {
        const map = Object.fromEntries(res.data.map((r) => [r.key, String(r.value)]));
        setGlobalRate(map.driverPayRatePerKmSar ?? '1.5');
        setGlobalFee(map.driverPlatformFeePercent ?? '15');
      }
    });
  }, []);

  const loadRuns = useCallback(() => {
    payrollService.listRuns().then((res) => {
      if (res.data) setRuns(res.data as RunSummary[]);
      setLoading(false);
    });
  }, []);

  const loadDetail = useCallback((y: number, m: number) => {
    setDetailLoading(true);
    payrollService.getRun(y, m).then((res) => {
      if (res.data) setRunDetail(res.data as PayrollRunDetail);
      else setRunDetail(null);
      setDetailLoading(false);
    });
  }, []);

  useEffect(() => {
    loadRules();
    loadRuns();
  }, [loadRules, loadRuns]);

  useEffect(() => {
    loadDetail(year, month);
  }, [year, month, loadDetail]);

  const economics = useMemo(() => {
    if (!runDetail) return null;
    return aggregatePeriodEconomics(runDetail.lines);
  }, [runDetail]);

  const fizzaRetention = economics ? fizzaRetentionFromDrivers(economics) : 0;
  const fizzaRetentionPaid = economics ? fizzaRetentionFromDriversPaid(economics) : 0;

  const saveGlobalRules = async () => {
    setSavingRules(true);
    setMsg(null);
    const res = await systemConfigService.update({
      driverPayRatePerKmSar: parseFloat(globalRate) || 0,
      driverPlatformFeePercent: parseFloat(globalFee) || 0,
    });
    setSavingRules(false);
    if (res.error) setMsg({ text: res.error.message, type: 'error' });
    else setMsg({ text: 'Global pay rules saved.', type: 'success' });
  };

  const generate = async (regenerate = false) => {
    setGenerating(true);
    setMsg(null);
    const res = await payrollService.generate({ year, month, regenerate });
    setGenerating(false);
    if (res.error) {
      setMsg({ text: res.error.message, type: 'error' });
      return;
    }
    setMsg({ text: regenerate ? 'Payroll regenerated.' : 'Payroll generated.', type: 'success' });
    loadRuns();
    loadDetail(year, month);
  };

  const openLineEditor = (line: PayrollLine) => {
    setSelectedLine(line);
    setEditDeductions(String(Number(line.deductionsSar)));
    setEditBonuses(String(Number(line.bonusesSar)));
    setEditNotes(line.adminNotes ?? '');
  };

  const saveLine = async (status?: 'DRAFT' | 'APPROVED') => {
    if (!selectedLine) return;
    const deductions = parseFloat(editDeductions) || 0;
    if (deductions > 0 && !editNotes.trim()) {
      setMsg({ text: 'Admin notes are required when applying deductions.', type: 'error' });
      return;
    }
    setLineSubmitting(true);
    const res = await payrollService.updateLine(selectedLine.id, {
      deductionsSar: parseFloat(editDeductions) || 0,
      bonusesSar: parseFloat(editBonuses) || 0,
      adminNotes: editNotes,
      status,
    });
    setLineSubmitting(false);
    if (res.error) {
      setMsg({ text: res.error.message, type: 'error' });
      return;
    }
    setSelectedLine(null);
    setMsg({ text: status === 'APPROVED' ? 'Line approved.' : 'Line updated.', type: 'success' });
    loadDetail(year, month);
    loadRuns();
  };

  const markPaid = async (lineId: string) => {
    const res = await payrollService.markPaid(lineId);
    if (res.error) {
      setMsg({ text: res.error.message, type: 'error' });
      return;
    }
    setMsg({ text: 'Payout processed.', type: 'success' });
    loadDetail(year, month);
    loadRuns();
  };

  const exportCsv = async () => {
    if (!runDetail) return;
    setExporting(true);
    const res = await payrollService.exportCsv(year, month);
    setExporting(false);
    if (res.error || !res.data) {
      setMsg({ text: res.error?.message ?? 'Export failed', type: 'error' });
      return;
    }
    downloadCsv(`fizza-payroll-${year}-${String(month).padStart(2, '0')}.csv`, res.data);
  };

  const saveTripKm = async (earningId: string, lineStatus: PayrollLine['status']) => {
    if (lineStatus === 'PAID') return;
    const raw = kmEdits[earningId];
    const billableKm = parseFloat(raw);
    if (!billableKm || billableKm <= 0) {
      setMsg({ text: 'Enter a valid km value', type: 'error' });
      return;
    }
    setKmSavingId(earningId);
    const res = await payrollService.updateTripEarningKm(earningId, billableKm);
    setKmSavingId(null);
    if (res.error) setMsg({ text: res.error.message, type: 'error' });
    else {
      setMsg({ text: 'Trip km updated.', type: 'success' });
      loadDetail(year, month);
    }
  };

  const saveSkippedTripKm = async (tripId: string) => {
    const billableKm = parseFloat(skippedKm[tripId] ?? '');
    if (!billableKm || billableKm <= 0) {
      setMsg({ text: 'Enter a valid km override', type: 'error' });
      return;
    }
    setSkippedSavingId(tripId);
    const res = await payrollService.setTripKmOverride(tripId, billableKm);
    setSkippedSavingId(null);
    if (res.error) setMsg({ text: res.error.message, type: 'error' });
    else setMsg({ text: 'Km override saved — regenerate payroll to include trip.', type: 'success' });
  };

  return (
    <div>
      <AdminSectionHeader
        title="Driver Payroll"
        subtitle="Trip-based pay: billable km × rate, minus platform fee. Generate monthly runs and approve payouts."
      />

      {msg && (
        <Alert variant={msg.type === 'success' ? 'success' : 'error'} className="mb-4">
          {msg.text}
        </Alert>
      )}

      <div className="mb-6">
        <AdminDataCard title="Global pay rules">
          <p className="text-sm text-gray-600 mb-4">
            Default rate and platform fee for all drivers. Per-driver overrides are set in the Drivers section.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rate per km (SAR)</label>
              <Input type="number" min={0} step={0.01} value={globalRate} onChange={(e) => setGlobalRate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Platform fee (%)</label>
              <Input type="number" min={0} max={100} step={0.1} value={globalFee} onChange={(e) => setGlobalFee(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" size="sm" loading={savingRules} onClick={saveGlobalRules}>
            Save global rules
          </Button>
        </AdminDataCard>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card mb-5 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[44px]"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[44px]"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
          >
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="outline" loading={generating} onClick={() => generate(false)}>
            <Calculator className="h-4 w-4 mr-1" />
            Generate
          </Button>
          {runDetail && (
            <>
              <Button size="sm" variant="outline" loading={exporting} onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" loading={generating} onClick={() => generate(true)}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <AdminSectionLoading />
      ) : (
        <>
          {economics && (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <AdminRevenueFlow
                title={`Platform economics · ${periodLabel(year, month)}`}
                subtitle="How driver trip earnings split between Fizza and driver payouts this period."
                rows={[
                  { label: 'Driver trip gross', value: formatSar(economics.gross), tone: 'neutral', helper: 'Billable km × rate across all drivers' },
                  { label: 'Platform fee (Fizza revenue)', value: formatSar(economics.platformFee), tone: 'inflow', helper: 'Percentage retained from trip gross' },
                  { label: 'Driver trip net', value: formatSar(economics.driverNet), tone: 'neutral', helper: 'Gross minus platform fee, before adjustments' },
                  ...(economics.deductions > 0 ? [{ label: 'Deductions withheld', value: `− ${formatSar(economics.deductions)}`, tone: 'inflow' as const, helper: 'Stays with Fizza — not paid to drivers' }] : []),
                  ...(economics.bonuses > 0 ? [{ label: 'Bonuses paid to drivers', value: `− ${formatSar(economics.bonuses)}`, tone: 'outflow' as const, helper: 'Added to driver net pay from Fizza' }] : []),
                  { label: 'Net pay due to drivers', value: formatSar(economics.netPay), tone: 'emphasis', helper: 'Trip net − deductions + bonuses' },
                ]}
                totalLabel="Total Fizza retention from drivers"
                totalValue={formatSar(fizzaRetention)}
                totalHelper="Platform fees + deductions withheld − bonuses"
                footnote="Parent subscription revenue is tracked separately in Financials."
              />
              <AdminDataCard title="Settlement status" compact>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminMetaItem label="Fizza retention (paid lines)" value={formatSar(fizzaRetentionPaid)} />
                  <AdminMetaItem label="Driver payouts completed" value={formatSar(economics.paidNet)} />
                  <AdminMetaItem label="Platform fees collected" value={formatSar(economics.paidPlatformFee)} />
                  <AdminMetaItem label="Deductions collected" value={formatSar(economics.paidDeductions)} />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <AdminMetricGrid
                    columns={4}
                    items={[
                      { label: 'Drivers', value: runDetail?.lines.length ?? 0 },
                      { label: 'Trips', value: runDetail?.lines.reduce((n, l) => n + l.tripCount, 0) ?? 0 },
                      { label: 'Billable km', value: runDetail?.lines.reduce((n, l) => n + Number(l.totalBillableKm), 0).toFixed(1) ?? '0' },
                      { label: 'Platform fees', value: formatSar(economics.platformFee), color: '#059669' },
                    ]}
                  />
                </div>
              </AdminDataCard>
            </div>
          )}

          {detailLoading ? (
            <AdminSectionLoading />
          ) : !runDetail ? (
            <AdminEmptyState
              icon={Banknote}
              title={`No payroll for ${periodLabel(year, month)}`}
              description="Generate payroll from completed trips in this period."
            />
          ) : (
            <>
              {(runDetail.skippedTripCount ?? 0) > 0 && (
                <AdminDataCard title={`Skipped trips (${runDetail.skippedTripCount})`} compact>
                  <p className="text-xs text-gray-500 mb-3">
                    Trips missing billable km. Set an override then regenerate payroll.
                  </p>
                  <div className="space-y-2">
                    {(runDetail.skippedTrips ?? []).map((s) => (
                      <div key={s.tripId} className="flex flex-wrap items-end gap-2 text-xs border-b border-gray-100 pb-2">
                        <div className="min-w-[140px]">
                          <p className="font-medium text-gray-800">{new Date(s.scheduledDate).toLocaleDateString()}</p>
                          <p className="text-gray-500 truncate max-w-[220px]">{s.tripId.slice(0, 8)}…</p>
                        </div>
                        <Input
                          type="number"
                          min={0.1}
                          step={0.1}
                          placeholder="Km override"
                          className="w-28 h-9"
                          value={skippedKm[s.tripId] ?? ''}
                          onChange={(e) => setSkippedKm((prev) => ({ ...prev, [s.tripId]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          loading={skippedSavingId === s.tripId}
                          onClick={() => saveSkippedTripKm(s.tripId)}
                        >
                          Save km
                        </Button>
                      </div>
                    ))}
                  </div>
                </AdminDataCard>
              )}

            <div className="space-y-3">
              {runDetail.lines.map((line) => (
                <AdminDataCard
                  key={line.id}
                  title={line.driver.profile?.fullName ?? 'Driver'}
                  subtitle={line.driver.profile?.user.email}
                  badges={<AdminStatusBadge status={line.status} label={LINE_STATUS_LABEL[line.status]} />}
                  compact
                  onClick={() => setExpandedLineId(expandedLineId === line.id ? null : line.id)}
                  metadata={
                    <>
                      <AdminMetaItem label="Trips" value={line.tripCount} />
                      <AdminMetaItem label="Km" value={Number(line.totalBillableKm).toFixed(1)} />
                      <AdminMetaItem label="Gross" value={formatSar(line.grossSar)} />
                      <AdminMetaItem label="Platform fee" value={formatSar(line.platformFeeSar)} />
                      {Number(line.deductionsSar) > 0 && (
                        <AdminMetaItem label="Deductions" value={`− ${formatSar(line.deductionsSar)}`} />
                      )}
                      {Number(line.bonusesSar) > 0 && (
                        <AdminMetaItem label="Bonuses" value={`+ ${formatSar(line.bonusesSar)}`} />
                      )}
                      <AdminMetaItem label="Net pay" value={formatSar(line.netPaySar)} />
                    </>
                  }
                  actions={
                    <div className="flex items-center gap-2">
                      {line.status === 'APPROVED' && (
                        <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); markPaid(line.id); }}>
                          Pay driver
                        </Button>
                      )}
                      {line.status !== 'PAID' && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openLineEditor(line); }}>
                          Edit
                        </Button>
                      )}
                      {expandedLineId === line.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  }
                >
                  {expandedLineId === line.id && (
                    <div className="mt-4 border-t pt-4 space-y-2">
                      {line.tripEarnings.map((te) => (
                        <div key={te.id} className="flex flex-wrap items-end gap-2 text-xs text-gray-600 py-2 border-b border-gray-100 last:border-0">
                          <div className="min-w-[160px]">
                            <span className="font-medium text-gray-900 block">
                              {new Date(te.trip.scheduledDate).toLocaleDateString()} · {te.trip.legType}
                            </span>
                            <span className="text-gray-500">{te.trip.pickupLocation.slice(0, 40)}…</span>
                          </div>
                          {line.status !== 'PAID' ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0.1}
                                step={0.1}
                                className="w-20 h-8 text-xs"
                                value={kmEdits[te.id] ?? String(Number(te.billableKm))}
                                onChange={(e) => setKmEdits((prev) => ({ ...prev, [te.id]: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={kmSavingId === te.id}
                                onClick={(e) => { e.stopPropagation(); saveTripKm(te.id, line.status); }}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <span>{Number(te.billableKm).toFixed(1)} km ({te.kmSource})</span>
                          )}
                          <span>Gross {formatSar(te.grossSar)}</span>
                          <span>Fee {formatSar(te.platformFeeSar)}</span>
                          <span className="text-emerald-700 font-medium">Net {formatSar(te.netSar)}</span>
                        </div>
                      ))}
                      {line.payoutRef && (
                        <p className="text-[11px] text-gray-500 pt-2">
                          Payout: {line.payoutMethod ?? 'MANUAL'} · ref {line.payoutRef}
                        </p>
                      )}
                      {line.payoutError && (
                        <p className="text-[11px] text-red-600 pt-1">{line.payoutError}</p>
                      )}
                    </div>
                  )}
                </AdminDataCard>
              ))}
            </div>
            </>
          )}

          {runs.length > 0 && (
            <div className="mt-8">
              <AdminDataCard title="Recent payroll runs">
              <div className="divide-y">
                {runs.slice(0, 6).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded-lg"
                    onClick={() => { setYear(r.year); setMonth(r.month); }}
                  >
                    <span className="font-medium">{periodLabel(r.year, r.month)}</span>
                    <span className="text-sm text-gray-600">
                      {r.lineCount} drivers · {formatSar(r.totalNetPaySar)} · {r.paidCount}/{r.lineCount} paid
                    </span>
                  </button>
                ))}
              </div>
              </AdminDataCard>
            </div>
          )}
        </>
      )}

      <AdminDrawer
        open={!!selectedLine}
        onClose={() => setSelectedLine(null)}
        title={selectedLine?.driver.profile?.fullName ?? 'Payroll line'}
        subtitle={`Trip net ${selectedLine ? formatSar(selectedLine.tripNetSar) : ''}`}
        footer={
          selectedLine && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" loading={lineSubmitting} onClick={() => saveLine()}>
                Save adjustments
              </Button>
              <Button variant="primary" className="flex-1" loading={lineSubmitting} onClick={() => saveLine('APPROVED')}>
                Approve
              </Button>
            </div>
          )
        }
      >
        {selectedLine && (() => {
          const previewNet = calculatePeriodNetPay({
            tripNetSar: Number(selectedLine.tripNetSar),
            deductionsSar: parseFloat(editDeductions) || 0,
            bonusesSar: parseFloat(editBonuses) || 0,
          });
          const previewRetention = Number(selectedLine.platformFeeSar)
            + (parseFloat(editDeductions) || 0)
            - (parseFloat(editBonuses) || 0);
          return (
          <>
            <AdminDrawerSection title="Summary">
              <AdminDrawerRow label="Trips" value={selectedLine.tripCount} />
              <AdminDrawerRow label="Billable km" value={Number(selectedLine.totalBillableKm).toFixed(1)} />
              <AdminDrawerRow label="Gross" value={formatSar(selectedLine.grossSar)} />
              <AdminDrawerRow label="Platform fee (Fizza keeps)" value={formatSar(selectedLine.platformFeeSar)} />
              <AdminDrawerRow label="Trip net" value={formatSar(selectedLine.tripNetSar)} />
            </AdminDrawerSection>
            <AdminDrawerSection title="Adjustments">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Deductions (SAR)</label>
                  <Input type="number" min={0} step={0.01} value={editDeductions} onChange={(e) => setEditDeductions(e.target.value)} />
                  <p className="text-[11px] text-gray-400 mt-1">Withheld by Fizza — reduces driver payout. Notes required if &gt; 0.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bonuses (SAR)</label>
                  <Input type="number" min={0} step={0.01} value={editBonuses} onChange={(e) => setEditBonuses(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Admin notes</label>
                  <Textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
              </div>
            </AdminDrawerSection>
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 px-4 py-3 text-sm">
              <p className="font-medium text-gray-900">Net pay preview</p>
              <p className="text-gray-600 mt-1 tabular-nums">
                {formatSar(selectedLine.tripNetSar)} − {formatSar(parseFloat(editDeductions) || 0)} + {formatSar(parseFloat(editBonuses) || 0)} = <span className="font-semibold text-emerald-800">{formatSar(previewNet)}</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Fizza retention from this driver: {formatSar(previewRetention)} (fee + deductions − bonuses)
              </p>
            </div>
          </>
          );
        })()}
      </AdminDrawer>
    </div>
  );
}
