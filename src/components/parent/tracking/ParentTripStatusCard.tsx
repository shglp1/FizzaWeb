'use client';

import { MapPin } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatTrackingTime, legLocationLabels } from '@/lib/parent/parentTrackingFormatters';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';
import type { TripLegType } from '@/lib/tracking/trackingTypes';

export function ParentTripStatusCard({
  pickupLocation,
  dropoffLocation,
  scheduledPickupTime,
  scheduledDropoffTime,
  actualPickupTime,
  actualDropoffTime,
  legType,
  statusReason,
}: {
  pickupLocation: string;
  dropoffLocation: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  legType?: TripLegType | null;
  statusReason?: string | null;
}) {
  const copy = getParentTrackingCopy('en');
  const labels = legLocationLabels(legType);

  return (
    <Card className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{copy.tripProgress}</p>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="text-xs text-gray-400">{labels.pickupShort}</p>
            <p className="font-medium text-gray-800">{pickupLocation}</p>
            <p className="text-xs text-gray-500">
              {copy.scheduledPickup}: {formatTrackingTime(scheduledPickupTime)}
            </p>
            {actualPickupTime && (
              <p className="text-xs text-emerald-700 font-medium">
                {copy.actualPickup}: {formatTrackingTime(actualPickupTime)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="text-xs text-gray-400">{labels.dropoffShort}</p>
            <p className="font-medium text-gray-800">{dropoffLocation}</p>
            <p className="text-xs text-gray-500">
              {copy.scheduledDropoff}: {formatTrackingTime(scheduledDropoffTime)}
            </p>
            {actualDropoffTime && (
              <p className="text-xs text-emerald-700 font-medium">
                {copy.actualDropoff}: {formatTrackingTime(actualDropoffTime)}
              </p>
            )}
          </div>
        </div>
      </div>
      {statusReason && <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{statusReason}</p>}
    </Card>
  );
}
