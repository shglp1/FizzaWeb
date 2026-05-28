'use client';

import Link from 'next/link';
import { Button, StatusBadge } from '@/components/ui';
import { MessageSquare } from 'lucide-react';
import { formatTrackingDate } from '@/lib/parent/parentTrackingFormatters';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';
import type { ParentTrackingStateId } from '@/lib/parent/parentTrackingState';

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'purple' | 'orange' | 'success' | 'danger'> = {
  driver_not_assigned: 'warning',
  waiting_for_window: 'warning',
  waiting_for_location: 'warning',
  driver_assigned: 'info',
  driver_en_route_to_pickup: 'purple',
  driver_minutes_away: 'purple',
  arriving_soon: 'orange',
  driver_at_pickup: 'orange',
  student_picked_up: 'orange',
  en_route_to_school: 'purple',
  en_route_to_home: 'purple',
  arrived_at_destination: 'success',
  arrived_home: 'success',
  trip_completed: 'success',
  location_unavailable: 'warning',
  gps_outdated: 'warning',
  trip_cancelled: 'danger',
  no_show: 'danger',
};

export function ParentTrackingHeader({
  riderName,
  scheduledDate,
  headline,
  stateId,
  onChat,
}: {
  riderName: string;
  scheduledDate: string;
  headline: string;
  stateId: ParentTrackingStateId;
  onChat: () => void;
}) {
  const copy = getParentTrackingCopy('en');
  return (
    <div className="mb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            {copy.pageTitle(riderName)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{formatTrackingDate(scheduledDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onChat} className="min-h-[44px]">
            <MessageSquare className="h-3.5 w-3.5 mr-1" aria-hidden />
            {copy.messageDriver}
          </Button>
          <Link href="/tracking">
            <Button variant="ghost" size="sm" className="min-h-[44px]">{copy.allTrips}</Button>
          </Link>
        </div>
      </div>
      <div className="mt-3" aria-live="polite">
        <StatusBadge variant={STATUS_VARIANT[stateId] ?? 'info'} className="text-sm px-3 py-1.5">
          {headline}
        </StatusBadge>
      </div>
    </div>
  );
}
