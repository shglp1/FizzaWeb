'use client';

import { Star } from 'lucide-react';
import { Card } from '@/components/ui';
import { VehicleDisplay } from '@/components/parent/VehicleDisplay';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= rounded ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
          aria-hidden
        />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

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
            <StarRating rating={Number(rating)} />
          )}
        </div>
      </div>
      {vehicle && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">{copy.vehicle}</p>
          <VehicleDisplay vehicle={vehicle} compact showLegacyBadge />
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
