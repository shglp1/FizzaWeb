'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminRiderService } from '@/services/adminService';

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
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleMsg, setToggleMsg] = useState('');

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
    setToggleMsg('');
    const res = await adminRiderService.update(rider.id, { isActive: !rider.isActive });
    setTogglingId(null);
    if (res.data) {
      setToggleMsg(`${rider.name} ${!rider.isActive ? 'activated' : 'deactivated'}.`);
      load(search, activeFilter, page);
    } else {
      setToggleMsg(res.error?.message ?? 'Update failed.');
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Riders</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          className="input text-sm flex-1 min-w-40"
          placeholder="Search by name or school…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input text-sm"
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Riders</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {toggleMsg && (
        <p className={`rounded-xl px-4 py-2 text-sm mb-4 ${toggleMsg.includes('fail') ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
          {toggleMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading riders…</div>
      ) : error ? (
        <div className="card text-red-600 text-sm">{error}</div>
      ) : riders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No riders found.</div>
      ) : (
        <div className="space-y-3">
          {riders.map((r) => (
            <div key={r.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-gray-800">{r.name}</p>
                  {!r.isActive && (
                    <span className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-full px-2">Inactive</span>
                  )}
                  {r.specialNeeds && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2">Special Needs</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {r.relationship}
                  {r.school ? ` · ${r.school}` : ''}
                  {r.grade ? ` (Grade ${r.grade})` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  Parent: {r.parent.fullName} · {r.parent.user.email}
                  {' · '}{r._count.subscriptions} subs · {r._count.trips} trips
                </p>
              </div>
              <button
                onClick={() => toggleActive(r)}
                disabled={togglingId === r.id}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all ${
                  r.isActive
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {togglingId === r.id ? '…' : r.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} riders)</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}
