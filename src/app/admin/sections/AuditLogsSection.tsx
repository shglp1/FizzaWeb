'use client';

import { ClipboardList, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { Button, Pagination, ErrorState } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminDataCard,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminAuditSeverityBadge,
  AdminEmptyState,
  AdminJsonDetails,
  AdminFilterSelect,
  AdminSectionLoading,
  AdminMetaItem,
} from '@/components/admin/AdminUI';
import {
  formatAuditAction,
  formatAuditTimestamp,
  getAuditSeverity,
  isCriticalAuditAction,
  summarizeAuditDetails,
  parseAuditDetails,
} from '@/lib/ui/adminAudit';

type Log = {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
};

type Meta = { page: number; totalPages: number; total: number };

export function AuditLogsSection() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Log | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const load = useCallback((p = 1, action = actionFilter) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (action) params.set('action', action);
    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); setLoading(false); return; }
        setLogs(data.logs ?? []);
        setMeta(data.meta ?? { page: 1, totalPages: 1, total: 0 });
        setLoading(false);
      })
      .catch(() => { setError('Failed to load audit logs.'); setLoading(false); });
  }, [actionFilter]);

  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/admin/audit-logs?dateFrom=${today}&limit=1`)
      .then((r) => r.json())
      .then(({ data }) => { if (data?.meta) setTodayCount(data.meta.total); })
      .catch(() => {});
  }, []);

  const criticalCount = logs.filter((l) => isCriticalAuditAction(l.action)).length;

  return (
    <div className="space-y-1">
      <AdminSectionHeader
        title="Audit Logs"
        subtitle="Platform activity trail for compliance and operations review"
        count={meta.total}
        countLabel="events"
        primaryAction={
          <Button variant="outline" size="sm" onClick={() => load(page)} className="min-h-[44px]">
            <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden />
            Refresh
          </Button>
        }
      />

      <AdminMetricGrid
        columns={3}
        items={[
          { label: 'Total Events', value: meta.total, icon: ClipboardList },
          { label: 'Today', value: todayCount ?? '—', helper: 'Events since midnight' },
          { label: 'Critical / Admin', value: criticalCount, icon: ShieldAlert, color: '#7C3AED', helper: 'On current page' },
        ]}
      />

      <AdminToolbar
        filters={[
          {
            id: 'audit-action-filter',
            label: 'Action',
            element: (
              <AdminFilterSelect
                id="audit-action-filter"
                value={actionFilter}
                onChange={(v) => { setActionFilter(v); setPage(1); load(1, v); }}
                options={[
                  { value: '', label: 'All actions' },
                  { value: 'LOGIN', label: 'Sign in' },
                  { value: 'DRIVER_APPROVED', label: 'Driver approved' },
                  { value: 'SUBSCRIPTION', label: 'Subscription events' },
                  { value: 'PAYMENT', label: 'Payment events' },
                  { value: 'SYSTEM_CONFIG', label: 'System config' },
                  { value: 'SAFETY', label: 'Safety reports' },
                ]}
              />
            ),
          },
        ]}
        activeChips={actionFilter ? [{ label: actionFilter, onRemove: () => { setActionFilter(''); setPage(1); load(1, ''); } }] : []}
        onReset={() => { setActionFilter(''); setPage(1); load(1, ''); }}
      />

      {loading ? (
        <AdminSectionLoading message="Loading audit logs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(page)} />
      ) : logs.length === 0 ? (
        <AdminEmptyState
          icon={ClipboardList}
          title="No audit events found"
          description="Try adjusting your action filter or check back later."
        />
      ) : (
        <>
          <div className="space-y-3">
            {logs.map((log) => {
              const severity = getAuditSeverity(log.action);
              const summary = summarizeAuditDetails(log.action, log.details);
              return (
                <AdminDataCard
                  key={log.id}
                  title={formatAuditAction(log.action)}
                  subtitle={log.user?.fullName ?? 'System'}
                  badges={<AdminAuditSeverityBadge severity={severity} />}
                  onClick={() => setSelected(log)}
                  compact
                >
                  <p className="text-sm text-gray-600 line-clamp-2">{summary}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{formatAuditTimestamp(log.createdAt)}</span>
                    {log.ipAddress && <span>IP {log.ipAddress}</span>}
                  </div>
                </AdminDataCard>
              );
            })}
          </div>

          {meta.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={(p) => { setPage(p); load(p); }}
              className="mt-5"
            />
          )}
        </>
      )}

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? formatAuditAction(selected.action) : ''}
        subtitle={selected ? formatAuditTimestamp(selected.createdAt) : undefined}
        width="lg"
      >
        {selected && (
          <>
            <AdminDrawerSection title="Event summary">
              <AdminDrawerRow label="Action" value={formatAuditAction(selected.action)} />
              <AdminDrawerRow label="Actor" value={selected.user?.fullName ?? 'System'} />
              <AdminDrawerRow label="Severity" value={<AdminAuditSeverityBadge severity={getAuditSeverity(selected.action)} />} />
              <AdminDrawerRow label="Summary" value={summarizeAuditDetails(selected.action, selected.details)} />
              {selected.ipAddress && <AdminDrawerRow label="IP address" value={selected.ipAddress} />}
            </AdminDrawerSection>

            {parseAuditDetails(selected.details) && (
              <AdminDrawerSection title="Parsed details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(parseAuditDetails(selected.details)!).map(([k, v]) => (
                    <AdminMetaItem key={k} label={k} value={String(v)} />
                  ))}
                </div>
              </AdminDrawerSection>
            )}

            {selected.details && (
              <AdminJsonDetails data={selected.details} label="Technical details (raw JSON)" />
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
