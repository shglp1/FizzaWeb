'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui';
import { getDriverMoreMenuActions, type MoreMenuAction } from '@/lib/ui/driverPortal';

type DriverTripMoreMenuProps = {
  trip: {
    id: string;
    status: string;
    scheduledPickupTime: string | null;
    pickupLocation: string;
    dropoffLocation: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
  };
  supportPhone?: string | null;
  onReportLate?: () => void;
  onMarkNoShow?: () => void;
  onCopyAddress?: (which: 'pickup' | 'dropoff', text: string) => void;
};

export function DriverTripMoreMenu({
  trip,
  supportPhone,
  onReportLate,
  onMarkNoShow,
  onCopyAddress,
}: DriverTripMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const actions = getDriverMoreMenuActions(trip, { supportPhone });

  function handleAction(action: MoreMenuAction) {
    if (action.disabled) return;
    setOpen(false);

    if (action.id === 'late') {
      onReportLate?.();
      return;
    }
    if (action.id === 'no_show') {
      onMarkNoShow?.();
      return;
    }
    if (action.id === 'copy_pickup') {
      onCopyAddress?.('pickup', trip.pickupLocation);
      setToast('Pickup address copied');
      return;
    }
    if (action.id === 'copy_dropoff') {
      onCopyAddress?.('dropoff', trip.dropoffLocation);
      setToast('Dropoff address copied');
      return;
    }
    if (action.href) {
      if (action.href.startsWith('tel:') || action.href.startsWith('http')) {
        window.open(action.href, action.href.startsWith('tel:') ? '_self' : '_blank');
      } else {
        window.location.href = action.href;
      }
    }
    action.onClick?.();
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-label="More actions" aria-expanded={open}>
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
      </Button>
      {toast && (
        <span className="absolute -top-8 right-0 z-20 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[10px] text-white shadow">
          {toast}
        </span>
      )}
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              title={action.disabled ? action.disabledReason : undefined}
              onClick={() => handleAction(action)}
              className={`flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${action.destructive ? 'text-red-600' : 'text-gray-800'}`}
            >
              <span className="font-medium">{action.label}</span>
              {action.disabled && action.disabledReason && (
                <span className="text-[10px] text-gray-400 mt-0.5">{action.disabledReason}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
