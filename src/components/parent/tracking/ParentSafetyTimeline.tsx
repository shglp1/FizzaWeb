'use client';

import { formatTrackingTime } from '@/lib/parent/parentTrackingFormatters';
import { buildParentSafetyTimeline } from '@/lib/parent/parentTrackingState';
import type { TripLegType } from '@/lib/tracking/trackingTypes';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';

export function ParentSafetyTimeline({
  status,
  legType,
  actualPickupTime,
  actualDropoffTime,
}: {
  status: string;
  legType?: TripLegType | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
}) {
  const copy = getParentTrackingCopy('en');
  const steps = buildParentSafetyTimeline({
    status,
    legType,
    actualPickupTime,
    actualDropoffTime,
  });

  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{copy.safetyTimeline}</p>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                step.done ? 'bg-emerald-500' : step.active ? 'bg-fizza-secondary ring-2 ring-emerald-200' : 'bg-gray-200'
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.active ? 'text-fizza-primary' : step.done ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.label}
              </p>
              {step.time && (
                <p className="text-xs text-gray-500 mt-0.5">{formatTrackingTime(step.time)}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
