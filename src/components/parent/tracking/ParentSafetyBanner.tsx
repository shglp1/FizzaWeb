'use client';

import { CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatTrackingTime } from '@/lib/parent/parentTrackingFormatters';
import type { ParentTrackingStateId } from '@/lib/parent/parentTrackingState';

export function ParentSafetyBanner({
  stateId,
  actualPickupTime,
  actualDropoffTime,
  riderName,
}: {
  stateId: ParentTrackingStateId;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  riderName: string;
}) {
  if (stateId === 'trip_completed' || actualDropoffTime) {
    return (
      <Card className="mb-4 border-emerald-200 bg-emerald-50">
        <div className="flex items-start gap-3" role="status">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Arrived safely</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              {riderName} arrived at {formatTrackingTime(actualDropoffTime ?? null)}.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (stateId === 'arrived_at_destination' || stateId === 'arrived_home') {
    return (
      <Card className="mb-4 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3" role="status">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {stateId === 'arrived_home' ? 'Arrived home' : 'Arrived at school'}
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              Your driver has arrived. Live tracking will close once the trip is marked complete.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (stateId === 'student_picked_up' || actualPickupTime) {
    return (
      <Card className="mb-4 border-emerald-200 bg-emerald-50/80">
        <div className="flex items-start gap-3" role="status">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Student picked up</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              {riderName} was picked up at {formatTrackingTime(actualPickupTime)}.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (
    stateId === 'driver_en_route_to_pickup' ||
    stateId === 'en_route_to_school' ||
    stateId === 'en_route_to_home' ||
    stateId === 'driver_minutes_away' ||
    stateId === 'arriving_soon'
  ) {
    return (
      <Card className="mb-4 border-blue-100 bg-blue-50/60">
        <div className="flex items-start gap-3" role="status">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-blue-900">
            Your driver is on the way. The map refreshes about every 15 seconds when location is shared.
          </p>
        </div>
      </Card>
    );
  }

  return null;
}
