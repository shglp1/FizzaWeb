'use client';

import { ArrowDown } from 'lucide-react';

type Props = {
  pickupLabel: string;
  dropoffLabel: string;
  pickupHint?: string;
  dropoffHint?: string;
  compact?: boolean;
  className?: string;
};

function segmentDir(label: string): 'rtl' | 'ltr' {
  return /[\u0600-\u06FF]/.test(label) ? 'rtl' : 'ltr';
}

export function RouteDisplay({
  pickupLabel,
  dropoffLabel,
  pickupHint = 'Pickup',
  dropoffHint = 'Drop-off',
  compact = false,
  className = '',
}: Props) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{pickupHint}</p>
        <p
          className={`text-sm font-medium text-gray-900 break-words leading-snug ${compact ? 'text-xs' : ''}`}
          dir={segmentDir(pickupLabel)}
        >
          {pickupLabel}
        </p>
      </div>
      <div className="flex justify-center" aria-hidden>
        <ArrowDown className="h-4 w-4 text-emerald-500" />
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{dropoffHint}</p>
        <p
          className={`text-sm font-medium text-gray-900 break-words leading-snug ${compact ? 'text-xs' : ''}`}
          dir={segmentDir(dropoffLabel)}
        >
          {dropoffLabel}
        </p>
      </div>
    </div>
  );
}
