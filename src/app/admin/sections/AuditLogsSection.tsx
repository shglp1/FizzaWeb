'use client';

import { ClipboardList, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminAuditService } from '@/services/adminService';
import { Button, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
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

type Meta = { page: number; limit: number; total: number; totalPages: number };

const SEVERITY_FILTER_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
  { value: 'admin', label: 'Admin / System' },
];

export function AuditLogsSection() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [selected, setSelected] = useState<Log | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminAuditService.list({
      action: actionFilter || undefined,
      actor: actorFilter || undefined,
      severity: severityFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit,
    }).then((res) => {
      if (res.data) {
        setLogs((res.data as { logs: Log[] }).logs ?? []);
        setMeta((res.data as { meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load audit logs.');
      }
      setLoading(false);
    });
  }, [actionFilter, actorFilter, severityFilter, dateFrom, dateTo, page, limit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    adminAuditService.list({ dateFrom: today, limit: 1, page: 1 }).then((res) => {
      if (res.data) setTodayCount((res.data as { meta: Meta }).meta.total);
    });
  }, []);

  const resetFilters = () => {
    setActionFilter('');
    setActorFilter('');
    setSeverityFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const criticalCount = logs.filter((l) => isCriticalAuditAction(l.action)).length;

  return (
    <div className="space-y-1">
      <AdminSectionHeader
        title="Audit Logs"
        subtitle="Platform activity trail for compliance and operations review"
        count={meta?.total}
        countLabel="events"
        primaryAction={
          <Button variant="outline" size="sm" onClick={() => load()} className="min-h-[44px]">
            <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden />
            Refresh
          </Button>
        }
      />

      <AdminMetricGrid
        columns={3}
        items={[
          { label: 'Total Events', value: meta?.total ?? '—', icon: ClipboardList },
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
                onChange={(v) => { setActionFilter(v); setPage(1); }}
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
          {
            id: 'audit-severity-filter',
            label: 'Severity',
            element: (
              <AdminFilterSelect
                id="audit-severity-filter"
                value={severityFilter}
                onChange={(v) => { setSeverityFilter(v); setPage(1); }}
                options={SEVERITY_FILTER_OPTIONS}
              />
            ),
          },
          {
            id: 'audit-actor-filter',
            label: 'Actor',
            element: (
              <input
                id="audit-actor-filter"
                type="search"
                className="input text-sm h-11 w-full min-h-[44px]"
                placeholder="Search by name…"
                value={actorFilter}
                onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
              />
            ),
          },
          {
            id: 'audit-from',
            label: 'From',
            element: (
              <input
                id="audit-from"
                type="date"
                className="input text-sm h-11 w-full min-h-[44px]"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              />
            ),
          },
          {
            id: 'audit-to',
            label: 'To',
            element: (
              <input
                id="audit-to"
                type="date"
                className="input text-sm h-11 w-full min-h-[44px]"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              />
            ),
          },
        ]}
        activeChips={[
          ...(actionFilter ? [{ label: actionFilter, onRemove: () => { setActionFilter(''); setPage(1); } }] : []),
          ...(severityFilter ? [{ label: `Severity: ${severityFilter}`, onRemove: () => { setSeverityFilter(''); setPage(1); } }] : []),
          ...(actorFilter ? [{ label: `Actor: ${actorFilter}`, onRemove: () => { setActorFilter(''); setPage(1); } }] : []),
          ...(dateFrom ? [{ label: `From ${dateFrom}`, onRemove: () => { setDateFrom(''); setPage(1); } }] : []),
          ...(dateTo ? [{ label: `To ${dateTo}`, onRemove: () => { setDateTo(''); setPage(1); } }] : []),
        ]}
        onReset={resetFilters}
      />

      {loading ? (
        <AdminSectionLoading message="Loading audit logs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : logs.length === 0 ? (
        <AdminEmptyState
          icon={ClipboardList}
          title="No audit events found"
          description="Try adjusting your filters or check back later."
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

          {meta && (
            <AdminPagination
              meta={meta}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
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
