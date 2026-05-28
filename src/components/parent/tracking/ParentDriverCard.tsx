'use client';

import { Card } from '@/components/ui';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';

export function ParentDriverCard({
  fullName,
  rating,
  phone,
  vehicle,
}: {
  fullName: string;
  rating: number | string | null;
  phone: string | null;
  vehicle: { model: string; plateNumber: string; color: string } | null;
}) {
  const copy = getParentTrackingCopy('en');

  return (
    <Card className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{copy.driver}</p>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-fizza-secondary/20 flex items-center justify-center text-lg font-bold text-fizza-primary">
          {fullName.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{fullName}</p>
          {rating != null && !Number.isNaN(Number(rating)) && (
            <p className="text-xs text-amber-500">Rating {Number(rating).toFixed(1)}</p>
          )}
        </div>
      </div>
      {vehicle && (
        <div className="text-xs text-gray-500 space-y-0.5 mb-3">
          <p className="font-medium text-gray-600">{copy.vehicle}</p>
          <p>{vehicle.color} {vehicle.model}</p>
          <p className="font-mono tracking-wider">{vehicle.plateNumber}</p>
        </div>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-emerald-50 text-fizza-secondary font-medium text-sm hover:bg-emerald-100"
        >
          {copy.callDriver}
        </a>
      )}
    </Card>
  );
}
