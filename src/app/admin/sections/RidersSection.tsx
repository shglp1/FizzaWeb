'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminRiderService } from '@/services/adminService';
import { Card, Badge, Button, Alert, Input, LoadingState, ErrorState, EmptyState, Pagination } from '@/components/ui';

type RiderRow = {
  id: string;
  name: string;
  relationship: string;
  school: string | null;
  grade: string | null;
  specialNeeds: boolean;
  isActive: boolean;
  createdAt: string;
  parent: { id: string; fullName: string; phone: string | null; user: { email: string } };
  _count: { subscriptions: number; trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function RidersSection() {
  const [riders, setRiders]       = useState<RiderRow[]>([]);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleMsg, setToggleMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback((s: string, a: string, p: number) => {
    setLoading(true);
    setError('');
    const isActive = a === 'true' ? true : a === 'false' ? false : undefined;
    adminRiderService.list({ search: s || undefined, isActive, page: p }).then((res) => {
      if (res.data) {
        setRiders((res.data as { riders: RiderRow[]; meta: Meta }).riders ?? []);
        setMeta((res.data as { riders: RiderRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load riders.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(search, activeFilter, page); }, [search, activeFilter, page, load]);

  const toggleActive = async (rider: RiderRow) => {
    setTogglingId(rider.id);
    setToggleMsg(null);
    const res = await adminRiderService.update(rider.id, { isActive: !rider.isActive });
    setTogglingId(null);
    if (res.data) {
      setToggleMsg({ text: `${rider.name} ${!rider.isActive ? 'activated' : 'deactivated'}.`, type: 'success' });
      load(search, activeFilter, page);
    } else {
      setToggleMsg({ text: res.error?.message ?? 'Update failed.', type: 'error' });
    }
  };

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Riders</h2>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-52">
          <Input
            placeholder="Search by name or school…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input text-sm h-10"
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Riders</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {toggleMsg && (
        <Alert variant={toggleMsg.type} className="mb-4" onClose={() => setToggleMsg(null)}>
          {toggleMsg.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState message="Loading riders…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search, activeFilter, page)} />
      ) : riders.length === 0 ? (
        <EmptyState icon="👦" title="No riders found" description="No riders match your current filter." />
      ) : (
        <div className="space-y-3">
          {riders.map((r) => (
            <Card key={r.id} className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
                {r.name[0]}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="font-medium text-gray-900">{r.name}</p>
                  {!r.isActive && <Badge variant="danger" className="text-[10px]">Inactive</Badge>}
                  {r.specialNeeds && <Badge variant="warning" className="text-[10px]">Special Needs</Badge>}
                </div>
                <p className="text-sm text-gray-500">
                  {r.relationship}
                  {r.school ? ` · ${r.school}` : ''}
                  {r.grade ? ` (Grade ${r.grade})` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Parent: {r.parent.fullName}
                  {' · '}{r._count.subscriptions} subs · {r._count.trips} trips
                </p>
              </div>

              {/* Toggle */}
              <Button
                variant={r.isActive ? 'danger-outline' : 'outline'}
                size="sm"
                loading={togglingId === r.id}
                onClick={() => toggleActive(r)}
                className="shrink-0"
              >
                {r.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
      )}
    </>
  );
}
