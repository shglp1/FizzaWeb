'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Input, LoadingState, ErrorState, Pagination } from '@/components/ui';

type Log = {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
};

type Meta = { page: number; totalPages: number; total: number };

function fmt(d: string) {
  return new Date(d).toLocaleString('en-SA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:                            'bg-blue-50 text-blue-700',
  LOGOUT:                           'bg-gray-100 text-gray-600',
  REGISTER:                         'bg-emerald-50 text-emerald-700',
  DRIVER_APPLICATION_SUBMITTED:     'bg-purple-50 text-purple-700',
  DRIVER_APPLICATION_RESUBMITTED:   'bg-orange-50 text-orange-700',
  DRIVER_APPROVED:                  'bg-green-50 text-green-700',
  DRIVER_REJECTED:                  'bg-red-50 text-red-700',
  DRIVER_SUSPENDED:                 'bg-red-50 text-red-700',
  SUBSCRIPTION_CANCELLED:           'bg-amber-50 text-amber-700',
};

export function AuditLogsSection() {
  const [logs, setLogs]     = useState<Log[]>([]);
  const [meta, setMeta]     = useState<Meta>({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);

  const load = (p = 1, action = search) => {
    setLoading(true);
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
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(1); }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-xs text-gray-500 mt-0.5">{meta.total} events recorded</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(1)}>Refresh</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Filter by action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1, search); } }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setPage(1); load(1, search); }}>Filter</Button>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setPage(1); load(1, ''); }}>Clear</Button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading audit logs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(page)} />
      ) : logs.length === 0 ? (
        <Card>
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">No audit logs found</p>
          </div>
        </Card>
      ) : (
        <>
          <Card padding="sm">
            <div className="divide-y divide-gray-50">
              {logs.map((log) => {
                const colorCls = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600';
                return (
                  <div key={log.id} className="flex items-start gap-3 py-3 px-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorCls}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        {log.user && (
                          <span className="text-xs text-gray-500">{log.user.fullName}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{log.details}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{fmt(log.createdAt)}</p>
                      {log.ipAddress && (
                        <p className="text-[10px] text-gray-300 mt-0.5">{log.ipAddress}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="mt-4">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={(p) => { setPage(p); load(p); }}
            />
          </div>
        </>
      )}
    </>
  );
}
