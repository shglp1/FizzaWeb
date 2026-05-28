'use client';

import { TRACKING_MARKER_COLORS } from '@/components/tracking/mapMarkerHelpers';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';
import { legLocationLabels } from '@/lib/parent/parentTrackingFormatters';
import type { TripLegType } from '@/lib/tracking/trackingTypes';

export function ParentMapLegend({ legType }: { legType?: TripLegType | null }) {
  const copy = getParentTrackingCopy('en');
  const labels = legLocationLabels(legType);

  const items = [
    { color: TRACKING_MARKER_COLORS.driver, label: copy.mapLegendDriver },
    { color: TRACKING_MARKER_COLORS.pickup, label: labels.pickupMarker },
    { color: TRACKING_MARKER_COLORS.dropoff, label: labels.dropoffMarker },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-[10px] font-medium text-gray-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
