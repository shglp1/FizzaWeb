'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminStatsService } from '@/services/adminService';

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

type KpiCard = { label: string; value: string | number; color: string };

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
    if (res.data) {
      setStats(res.data as Stats);
    } else {
      setError(res.error?.message ?? 'Failed to load stats.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const kpis: KpiCard[] = stats
    ? [
        { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-700' },
        { label: 'Total Riders', value: stats.totalRiders, color: 'text-purple-700' },
        { label: 'Drivers (active)', value: stats.totalDrivers, color: 'text-indigo-700' },
        { label: 'Pending Applications', value: stats.pendingApplications, color: 'text-amber-700' },
        { label: 'Active Subscriptions', value: stats.activeSubscriptions, color: 'text-emerald-700' },
        { label: 'Pending Subscriptions', value: stats.pendingSubscriptions, color: 'text-orange-700' },
        { label: "Today's Trips", value: stats.todayTrips, color: 'text-sky-700' },
        { label: 'Active Trips Now', value: stats.activeTrips, color: 'text-teal-700' },
        { label: 'Completed Today', value: stats.completedTodayTrips, color: 'text-green-700' },
        { label: 'Pending Payments', value: stats.pendingPayments, color: 'text-red-700' },
        { label: 'Total Revenue (SAR)', value: `SAR ${stats.totalRevenueSar.toFixed(2)}`, color: 'text-emerald-700' },
        { label: 'Safety Reports (open)', value: stats.pendingSafetyReports, color: 'text-rose-700' },
      ]
    : [];

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading overview…</div>;
  if (error) return <div className="card text-red-600 text-sm">{error}</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Overview</h2>
        <div className="flex items-center gap-3">
          {refreshing && <span className="text-xs text-gray-400">Refreshing…</span>}
          {stats?.lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {new Date(stats.lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => load(true)} className="text-xs text-emerald-600 hover:underline">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Pending Applications', section: 'applications', badge: stats?.pendingApplications },
            { label: 'Open Safety Reports', section: 'safety', badge: stats?.pendingSafetyReports },
            { label: 'Manage Subscriptions', section: 'subscriptions', badge: null },
            { label: 'Financial Overview', section: 'financials', badge: null },
            { label: 'System Configuration', section: 'sysconfig', badge: null },
            { label: 'Manage Drivers', section: 'drivers', badge: null },
          ].map((item) => (
            <button
              key={item.section}
              onClick={() => onNavigate(item.section)}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
            >
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              {item.badge ? (
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
