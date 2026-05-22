'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminDriverService } from '@/services/adminService';

type DriverRow = {
  id: string;
  availability: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  rating: string | null;
  createdAt: string;
  profile: { id: string; fullName: string; phone: string | null; user: { email: string } } | null;
  vehicle: { model: string; plateNumber: string; color: string | null; capacity: number | null } | null;
  _count: { trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function DriversSection() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');
  const [page, setPage] = useState(1);

  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback((sf: string, p: number) => {
    setLoading(true);
    setError('');
    const isSuspended = sf === 'true' ? true : sf === 'false' ? false : undefined;
    adminDriverService.list({ isSuspended, page: p }).then((res) => {
      if (res.data) {
        setDrivers((res.data as { drivers: DriverRow[]; meta: Meta }).drivers ?? []);
        setMeta((res.data as { drivers: DriverRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load drivers.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(suspendedFilter, page); }, [suspendedFilter, page, load]);

  const openAction = (id: string, type: 'suspend' | 'unsuspend') => {
    if (actionId === id && actionType === type) { setActionId(null); return; }
    setActionId(id);
    setActionType(type);
    setSuspendReason('');
    setActionMsg('');
  };

  const submitAction = async (id: string) => {
    if (actionType === 'suspend' && !suspendReason.trim()) {
      setActionMsg('Suspension reason is required.');
      return;
    }
    setSubmitting(true);
    setActionMsg('');
    const res = await adminDriverService.update(id, {
      isSuspended: actionType === 'suspend',
      suspensionReason: actionType === 'suspend' ? suspendReason.trim() : undefined,
    });
    setSubmitting(false);
    if (res.data) {
      setActionMsg(`Driver ${actionType === 'suspend' ? 'suspended' : 'reinstated'} successfully.`);
      setActionId(null);
      load(suspendedFilter, page);
    } else {
      setActionMsg(res.error?.message ?? 'Action failed.');
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Drivers</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="input text-sm"
          value={suspendedFilter}
          onChange={(e) => { setSuspendedFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Drivers</option>
          <option value="false">Active Only</option>
          <option value="true">Suspended Only</option>
        </select>
      </div>

      {actionMsg && !actionId && (
        <p className={`rounded-xl px-4 py-2 text-sm mb-4 ${actionMsg.includes('fail') || actionMsg.includes('required') ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
          {actionMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading drivers…</div>
      ) : error ? (
        <div className="card text-red-600 text-sm">{error}</div>
      ) : drivers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No drivers found.</div>
      ) : (
        <div className="space-y-4">
          {drivers.map((d) => {
            const isActioning = actionId === d.id;
            return (
              <div key={d.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{d.profile?.fullName ?? 'Unknown Driver'}</p>
                      {d.isSuspended ? (
                        <span className="text-xs bg-red-50 text-red-700 border border-red-100 rounded-full px-2">Suspended</span>
                      ) : (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2">Active</span>
                      )}
                      {!d.availability && (
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2">Unavailable</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{d.profile?.user.email}</p>
                    {d.rating && <p className="text-xs text-amber-600">★ {Number(d.rating).toFixed(1)}</p>}
                  </div>
                  {d.vehicle && (
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-medium">{d.vehicle.model}</p>
                      <p className="font-mono">{d.vehicle.plateNumber}</p>
                      {d.vehicle.color && <p>{d.vehicle.color}</p>}
                      {d.vehicle.capacity && <p>{d.vehicle.capacity} seats</p>}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 mb-3">{d._count.trips} total trips</p>

                {d.isSuspended && d.suspensionReason && (
                  <div className="text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-red-700 mb-3">
                    <span className="font-semibold">Suspension reason: </span>{d.suspensionReason}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {!d.isSuspended ? (
                    <button
                      onClick={() => openAction(d.id, 'suspend')}
                      className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        isActioning && actionType === 'suspend'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'border-red-200 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      {isActioning && actionType === 'suspend' ? 'Cancel' : 'Suspend'}
                    </button>
                  ) : (
                    <button
                      onClick={() => submitAction(d.id)}
                      disabled={submitting && actionId === d.id}
                      className="text-sm px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium"
                    >
                      {submitting && actionId === d.id ? '…' : 'Reinstate'}
                    </button>
                  )}
                </div>

                {isActioning && actionType === 'suspend' && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <textarea
                      rows={2}
                      className="input w-full resize-none text-sm"
                      placeholder="Reason for suspension (required)…"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                    />
                    {actionMsg && <p className="text-xs text-red-600">{actionMsg}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => submitAction(d.id)} disabled={submitting} className="btn-primary text-sm px-4 py-2">
                        {submitting ? 'Suspending…' : 'Confirm Suspension'}
                      </button>
                      <button onClick={() => setActionId(null)} className="btn-outline text-sm px-4 py-2">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}
