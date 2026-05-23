'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminStatsService } from '@/services/adminService';
import { StatCard, Card, Button, LoadingState, ErrorState } from '@/components/ui';

type Stats = {
  totalUsers: number;
  totalRiders: number;
  totalDrivers: number;
  pendingApplications: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  todayTrips: number;
  activeTrips: number;
  completedTodayTrips: number;
  pendingPayments: number;
  totalRevenueSar: number;
  pendingSafetyReports: number;
  lastUpdated: string;
};

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

  if (loading) return <LoadingState message="Loading overview…" />;
  if (error)   return <ErrorState message={error} onRetry={() => load()} />;
  if (!stats)  return null;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Platform Overview</h2>
          {stats.lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {new Date(stats.lastUpdated).toLocaleTimeString()}
              {refreshing && ' · Refreshing…'}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} loading={refreshing}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </Button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users"          value={stats.totalUsers}          color="#3B82F6"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <StatCard label="Total Riders"         value={stats.totalRiders}         color="#8B5CF6"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
        <StatCard label="Active Drivers"       value={stats.totalDrivers}        color="#6366F1"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} />
        <StatCard label="Pending Applications" value={stats.pendingApplications} color="#F59E0B"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
        <StatCard label="Active Subscriptions" value={stats.activeSubscriptions} color="#10B981"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <StatCard label="Pending Subscriptions" value={stats.pendingSubscriptions} color="#F97316"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <StatCard label="Today's Trips"        value={stats.todayTrips}          color="#0EA5E9"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        <StatCard label="Active Trips Now"     value={stats.activeTrips}         color="#14B8A6"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>} />
        <StatCard label="Completed Today"      value={stats.completedTodayTrips} color="#22C55E"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>} />
        <StatCard label="Pending Payments"     value={stats.pendingPayments}     color="#EF4444"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
        <StatCard label="Total Revenue"        value={`SAR ${stats.totalRevenueSar.toLocaleString('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} color="#10B981"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
        <StatCard label="Open Safety Reports"  value={stats.pendingSafetyReports} color="#F43F5E"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
      </div>

      {/* Quick Actions */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Pending Applications', section: 'applications', badge: stats.pendingApplications, emoji: '📝' },
            { label: 'Open Safety Reports',  section: 'safety',        badge: stats.pendingSafetyReports, emoji: '🛡️' },
            { label: 'Manage Subscriptions', section: 'subscriptions', badge: null, emoji: '📋' },
            { label: 'Financial Overview',   section: 'financials',    badge: null, emoji: '💰' },
            { label: 'System Configuration', section: 'sysconfig',     badge: null, emoji: '⚙️' },
            { label: 'Manage Drivers',       section: 'drivers',       badge: null, emoji: '🚗' },
          ].map((item) => (
            <button
              key={item.section}
              onClick={() => onNavigate(item.section)}
              className="flex items-center justify-between px-3.5 py-3 rounded-xl border border-gray-200 hover:border-fizza-secondary hover:bg-emerald-50/50 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{item.emoji}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-fizza-primary">{item.label}</span>
              </div>
              {item.badge ? (
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold shrink-0">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
