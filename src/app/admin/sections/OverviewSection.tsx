'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminStatsService } from '@/services/adminService';
import { Button, ErrorState } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';
import { formatSar } from '@/lib/ui/adminCurrency';
import { OVERVIEW_KPI_CONFIG, OVERVIEW_QUICK_ACTIONS } from '@/lib/ui/adminOverview';
import {
  formatAuditAction,
  formatAuditTimestamp,
  summarizeAuditDetails,
} from '@/lib/ui/adminAudit';
import { RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

type NeedsAttention = {
  unassignedTrips: number;
  delayedTrips: number;
  pendingApplications: number;
  pendingPayments: number;
  failedPayments: number;
  openSafetyReports: number;
};

type TodayOperations = {
  total: number;
  active: number;
  completed: number;
  unassigned: number;
  delayed: number;
};

type ActivityItem = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { fullName: string } | null;
};

type Stats = {
  totalUsers: number;
  activeSubscriptions: number;
  todayTrips: number;
  totalRevenueSar: number;
  pendingPayments: number;
  pendingSafetyReports: number;
  pendingApplications: number;
  chatFlags: number;
  needsAttention: NeedsAttention;
  todayOperations: TodayOperations;
  recentActivity: ActivityItem[];
  lastUpdated: string;
};

function kpiValue(stats: Stats, key: string): number | string {
  switch (key) {
    case 'users': return stats.totalUsers;
    case 'activeSubscriptions': return stats.activeSubscriptions;
    case 'tripsToday': return stats.todayTrips;
    case 'revenue': return formatSar(stats.totalRevenueSar);
    case 'pendingPayments': return stats.pendingPayments;
    case 'openSafetyReports': return stats.pendingSafetyReports;
    case 'pendingApplications': return stats.pendingApplications;
    case 'chatFlags': return stats.chatFlags;
    default: return '—';
  }
}

export function OverviewSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    const res = await adminStatsService.get();
    if (res.data) setStats(res.data as Stats);
    else setError(res.error?.message ?? 'Failed to load stats.');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <AdminSectionLoading message="Loading admin overview…" />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;
  if (!stats) return null;

  const attentionItems = [
    { label: 'Unassigned trips today', value: stats.needsAttention.unassignedTrips, section: 'trips' },
    { label: 'Delayed trips', value: stats.needsAttention.delayedTrips, section: 'trips' },
    { label: 'Pending applications', value: stats.needsAttention.pendingApplications, section: 'applications' },
    { label: 'Pending payments', value: stats.needsAttention.pendingPayments, section: 'financials' },
    { label: 'Failed payments', value: stats.needsAttention.failedPayments, section: 'financials' },
    { label: 'Open safety reports', value: stats.needsAttention.openSafetyReports, section: 'safety' },
  ].filter((i) => i.value > 0);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Admin Overview"
        subtitle="Command center for daily operations and platform health"
        primaryAction={
          <Button variant="outline" size="sm" onClick={() => load(true)} loading={refreshing} className="min-h-[44px]">
            <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden />
            Refresh
          </Button>
        }
      />

      {stats.lastUpdated && (
        <p className="text-xs text-gray-400 -mt-4">
          Updated {new Date(stats.lastUpdated).toLocaleTimeString()}
          {refreshing && ' · Refreshing…'}
        </p>
      )}

      <AdminMetricGrid
        columns={4}
        items={OVERVIEW_KPI_CONFIG.map((kpi) => ({
          label: kpi.label,
          value: kpiValue(stats, kpi.key),
          icon: kpi.icon,
          color: kpi.color,
          onClick: kpi.section ? () => onNavigate(kpi.section!) : undefined,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Today&apos;s operations</h3>
          <div className="grid grid-cols-2 gap-3">
            <AdminMetaItem label="Total trips" value={stats.todayOperations.total} />
            <AdminMetaItem label="Active now" value={stats.todayOperations.active} />
            <AdminMetaItem label="Completed" value={stats.todayOperations.completed} />
            <AdminMetaItem label="Unassigned" value={stats.todayOperations.unassigned} />
            <AdminMetaItem label="Delayed" value={stats.todayOperations.delayed} />
          </div>
          <Button variant="ghost" size="sm" className="mt-3 min-h-[44px]" onClick={() => onNavigate('trips')}>
            Open trips board
            <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
          </Button>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900">Needs attention</h3>
          </div>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-gray-500">No urgent items right now.</p>
          ) : (
            <ul className="space-y-2">
              {attentionItems.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.section)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 min-h-[44px]"
                  >
                    <span className="text-sm text-gray-700">{item.label}</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">{item.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent activity</h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No recent audit events.</p>
        ) : (
          <div className="space-y-2">
            {stats.recentActivity.map((item) => (
              <AdminDataCard
                key={item.id}
                title={formatAuditAction(item.action)}
                subtitle={item.user?.fullName ?? 'System'}
                compact
              >
                <p className="text-sm text-gray-600 line-clamp-2">
                  {summarizeAuditDetails(item.action, item.details)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{formatAuditTimestamp(item.createdAt)}</p>
              </AdminDataCard>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" className="mt-3 min-h-[44px]" onClick={() => onNavigate('audit')}>
          View all audit logs
        </Button>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OVERVIEW_QUICK_ACTIONS.map((action) => (
            <button
              key={action.section + action.label}
              type="button"
              onClick={() => onNavigate(action.section)}
              className="rounded-xl border border-gray-200 px-3.5 py-3 text-left hover:border-fizza-secondary hover:bg-emerald-50/40 transition-colors min-h-[44px]"
            >
              <p className="text-sm font-medium text-gray-900">{action.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
