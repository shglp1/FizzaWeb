'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminDriverService } from '@/services/adminService';
import {
  Card, Badge, StatusBadge, Button, Alert, Textarea,
  LoadingState, ErrorState, EmptyState, Pagination,
} from '@/components/ui';

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
  const [drivers, setDrivers]     = useState<DriverRow[]>([]);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');
  const [page, setPage]           = useState(1);

  const [actionId, setActionId]       = useState<string | null>(null);
  const [actionType, setActionType]   = useState<'suspend' | 'unsuspend' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionMsg, setActionMsg]     = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting]   = useState(false);

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
    setActionMsg(null);
  };

  const submitAction = async (id: string) => {
    if (actionType === 'suspend' && !suspendReason.trim()) {
      setActionMsg({ text: 'Suspension reason is required.', type: 'error' });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    const res = await adminDriverService.update(id, {
      isSuspended: actionType === 'suspend',
      suspensionReason: actionType === 'suspend' ? suspendReason.trim() : undefined,
    });
    setSubmitting(false);
    if (res.data) {
      setActionMsg({ text: `Driver ${actionType === 'suspend' ? 'suspended' : 'reinstated'} successfully.`, type: 'success' });
      setActionId(null);
      load(suspendedFilter, page);
    } else {
      setActionMsg({ text: res.error?.message ?? 'Action failed.', type: 'error' });
    }
  };

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Drivers</h2>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          className="input text-sm h-10"
          value={suspendedFilter}
          onChange={(e) => { setSuspendedFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Drivers</option>
          <option value="false">Active Only</option>
          <option value="true">Suspended Only</option>
        </select>
      </div>

      {actionMsg && !actionId && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState message="Loading drivers…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(suspendedFilter, page)} />
      ) : drivers.length === 0 ? (
        <EmptyState icon="car" title="No drivers found" description="No drivers match your current filter." />
      ) : (
        <div className="space-y-4">
          {drivers.map((d) => {
            const isActioning = actionId === d.id;
            return (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                      {d.profile?.fullName?.[0] ?? 'D'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900">{d.profile?.fullName ?? 'Unknown Driver'}</p>
                        <StatusBadge variant={d.isSuspended ? 'danger' : 'success'}>
                          {d.isSuspended ? 'Suspended' : 'Active'}
                        </StatusBadge>
                        {!d.availability && !d.isSuspended && (
                          <Badge variant="gray" className="text-[10px]">Unavailable</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{d.profile?.user.email}</p>
                      {d.profile?.phone && <p className="text-xs text-gray-400">{d.profile.phone}</p>}
                      {d.rating && <p className="text-xs text-amber-600 font-medium mt-0.5">Rating {Number(d.rating).toFixed(1)}</p>}
                    </div>
                  </div>
                  {d.vehicle && (
                    <div className="text-right text-xs text-gray-500 shrink-0">
                      <p className="font-medium text-gray-700">{d.vehicle.model}</p>
                      <p className="font-mono">{d.vehicle.plateNumber}</p>
                      {d.vehicle.color && <p>{d.vehicle.color}</p>}
                      {d.vehicle.capacity && <p>{d.vehicle.capacity} seats</p>}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 mb-3">{d._count.trips} total trips</p>

                {d.isSuspended && d.suspensionReason && (
                  <div className="text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-red-700 mb-3">
                    <span className="font-semibold">Reason: </span>{d.suspensionReason}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {!d.isSuspended ? (
                    <Button
                      variant="danger-outline"
                      size="sm"
                      onClick={() => openAction(d.id, 'suspend')}
                    >
                      {isActioning && actionType === 'suspend' ? 'Cancel' : 'Suspend'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={submitting && actionId === d.id}
                      onClick={() => { setActionId(d.id); setActionType('unsuspend'); submitAction(d.id); }}
                    >
                      Reinstate
                    </Button>
                  )}
                </div>

                {isActioning && actionType === 'suspend' && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    <Textarea
                      rows={2}
                      placeholder="Reason for suspension (required)…"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      error={actionMsg?.type === 'error' ? actionMsg.text : undefined}
                    />
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" loading={submitting} onClick={() => submitAction(d.id)}>
                        Confirm Suspension
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setActionId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
      )}
    </>
  );
}
