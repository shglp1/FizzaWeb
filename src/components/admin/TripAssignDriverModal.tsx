'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button, Alert } from '@/components/ui';
import { AdminDrawer, AdminDrawerRow } from '@/components/admin/AdminUI';
import { tripService } from '@/services/tripService';
import { formatAssignConflictMessage, formatRouteSummary, formatTripDateTime } from '@/lib/ui/adminTrips';

type AvailableDriver = {
  id: string;
  fullName: string;
  phone: string | null;
  availability: boolean;
  rating: number | null;
  vehicle: { model: string; plateNumber: string; color: string | null; capacity: number | null } | null;
  tripsToday: number;
  feasible: boolean;
  conflictReason: string | null;
};

export function TripAssignDriverModal({
  open,
  tripId,
  tripLabel,
  tripDate,
  tripPickupTime,
  pickup,
  dropoff,
  mode = 'assign',
  onClose,
  onSuccess,
}: {
  open: boolean;
  tripId: string;
  tripLabel: string;
  tripDate: string;
  tripPickupTime: string | null;
  pickup: string;
  dropoff: string;
  mode?: 'assign' | 'reassign';
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open || !tripId) return;
    setLoading(true);
    setLoadError('');
    setSelectedId('');
    setSubmitError('');
    tripService.adminTripAvailableDrivers(tripId).then((res) => {
      if (res.data?.drivers) setDrivers(res.data.drivers);
      else setLoadError(res.error?.message ?? 'Could not load drivers.');
      setLoading(false);
    }).catch(() => {
      setLoadError('Could not load drivers.');
      setLoading(false);
    });
  }, [open, tripId]);

  const submit = async () => {
    if (!selectedId) {
      setSubmitError('Please select a driver.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const res = mode === 'reassign'
      ? await tripService.adminReassignTrip(tripId, selectedId, 'Admin reassignment from trips board')
      : await tripService.adminAssignDriver(tripId, selectedId);
    setSubmitting(false);
    if (res.data) {
      onSuccess(mode === 'reassign' ? 'Driver reassigned successfully.' : 'Driver assigned successfully.');
      onClose();
    } else {
      setSubmitError(formatAssignConflictMessage(res.error?.message));
    }
  };

  const selected = drivers.find((d) => d.id === selectedId);

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={mode === 'reassign' ? 'Reassign driver' : 'Assign driver'}
      subtitle={tripLabel}
      width="lg"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={submit} className="min-h-[44px]">
            {mode === 'reassign' ? 'Confirm reassignment' : 'Confirm assignment'}
          </Button>
        </div>
      }
    >
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-sm space-y-1">
        <p className="font-medium text-gray-900">{formatTripDateTime(tripDate, tripPickupTime)}</p>
        <p className="text-xs text-gray-500">{formatRouteSummary(pickup, dropoff, 56)}</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {submitError && <Alert variant="error">{submitError}</Alert>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading available drivers…
        </div>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No drivers available.</p>
      ) : (
        <div className="space-y-2">
          {drivers.map((d) => {
            const isSelected = selectedId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={[
                  'w-full text-left rounded-xl border p-3 transition-colors min-h-[44px]',
                  isSelected ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-gray-100 bg-white hover:border-gray-200',
                  !d.feasible ? 'opacity-95' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{d.fullName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.vehicle ? `${d.vehicle.model} · ${d.vehicle.plateNumber}` : 'No vehicle'}
                      {d.vehicle?.capacity ? ` · ${d.vehicle.capacity} seats` : ''}
                    </p>
                    <p className="text-xs text-gray-500">{d.tripsToday} trips today{d.rating != null ? ` · Rating ${d.rating.toFixed(1)}` : ''}</p>
                  </div>
                  {d.feasible ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Feasible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Conflict
                    </span>
                  )}
                </div>
                {!d.feasible && d.conflictReason && (
                  <p className="text-xs text-amber-700 mt-2">{formatDispatchNoteSummary(d.conflictReason, 120)}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && !selected.feasible && (
        <Alert variant="warning">
          This driver has a timeline conflict. You can still try to assign — the server will reject it if not feasible.
        </Alert>
      )}

      {selected && (
        <div className="rounded-xl border border-gray-100 p-3">
          <AdminDrawerRow label="Selected" value={selected.fullName} />
          <AdminDrawerRow label="Status" value={selected.feasible ? 'Ready to assign' : 'Schedule conflict'} />
        </div>
      )}
    </AdminDrawer>
  );
}

function formatDispatchNoteSummary(note: string, max: number): string {
  if (note.length <= max) return note;
  return `${note.slice(0, max - 1)}…`;
}
