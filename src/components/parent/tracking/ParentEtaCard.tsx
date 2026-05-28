'use client';

import { Clock } from 'lucide-react';
import { Card } from '@/components/ui';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';
import type { ParentTrackingState } from '@/lib/parent/parentTrackingState';
import { formatTrackingTime } from '@/lib/parent/parentTrackingFormatters';

export function ParentEtaCard({
  state,
  scheduledPickupTime,
  scheduledDropoffTime,
}: {
  state: ParentTrackingState;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
}) {
  const copy = getParentTrackingCopy('en');

  if (state.id === 'trip_completed' || state.id === 'trip_cancelled' || state.id === 'no_show') {
    return null;
  }

  const showLiveEta =
    state.etaMinutes != null &&
    state.etaMinutes > 0 &&
    (state.etaTarget === 'pickup' || state.etaTarget === 'dropoff');

  const targetLabel =
    state.etaTarget === 'dropoff'
      ? 'Estimated arrival at destination'
      : state.etaTarget === 'pickup'
      ? 'Estimated arrival at pickup'
      : 'Next scheduled time';

  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-fizza-secondary shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{targetLabel}</p>
          {showLiveEta ? (
            <p className="text-lg font-bold text-gray-900 mt-1">
              About {Math.max(1, Math.round(state.etaMinutes!))} min
            </p>
          ) : state.minutesToScheduledPickup != null && state.minutesToScheduledPickup > 0 && state.id === 'waiting_for_window' ? (
            <p className="text-lg font-bold text-gray-900 mt-1">
              {copy.scheduledIn(state.minutesToScheduledPickup)}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mt-1">{copy.liveEtaUnavailable}</p>
          )}
          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
            <p>Pickup: {formatTrackingTime(scheduledPickupTime)}</p>
            <p>Drop-off: {formatTrackingTime(scheduledDropoffTime)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
