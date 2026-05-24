'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TripEventIcon } from '@/components/trips/TripEventIcon';
import { formatTripActivityLabel } from '@/lib/ui/driverPortal';

type TripEvent = {
  id: string;
  eventType: string;
  message: string | null;
  actorRole: string;
  createdAt: string;
};

export function DriverTripActivityPanel({
  events,
  defaultOpen = false,
}: {
  events: TripEvent[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (events.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-50/80"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Trip activity</p>
          <p className="text-xs text-gray-500">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2.5 text-sm">
              <TripEventIcon eventType={ev.eventType} className="h-4 w-4 text-emerald-600 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-800 font-medium">{formatTripActivityLabel(ev.eventType, ev.message)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {ev.actorRole} · {new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
