'use client';

import { Button } from '@/components/ui';
import type { StatusConfirmKind } from '@/lib/ui/driverLifecycleConfirm';
import { GPS_WARN_ON_STATUS } from '@/lib/ui/driverLifecycleConfirm';

export function DriverStatusConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  requireReason = false,
  reason = '',
  onReasonChange,
  showGpsWarning = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  requireReason?: boolean;
  reason?: string;
  onReasonChange?: (v: string) => void;
  showGpsWarning?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  kind?: StatusConfirmKind;
}) {
  if (!open) return null;

  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{body}</p>
        {showGpsWarning && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3">
            {GPS_WARN_ON_STATUS}
          </p>
        )}
        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => onReasonChange?.(e.target.value)}
            placeholder="Reason (required)"
            rows={2}
            className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        )}
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant={requireReason ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            disabled={!canConfirm}
            onClick={onConfirm}
            className="w-full min-h-10"
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} className="w-full min-h-10">
            {showGpsWarning ? 'Enable GPS first' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
