'use client';

import Image from 'next/image';
import { Car } from 'lucide-react';
import {
  formatVehicleDisplayLine,
  getVehicleImagePath,
  normalizeVehicleForDisplay,
  type VehicleLike,
} from '@/lib/vehicles/vehicleDisplay';

type Props = {
  vehicle: VehicleLike | null | undefined;
  compact?: boolean;
  showLegacyBadge?: boolean;
};

/** Parent-safe vehicle block with local illustration assets. */
export function VehicleDisplay({ vehicle, compact = false, showLegacyBadge = false }: Props) {
  const normalized = normalizeVehicleForDisplay(vehicle);
  const imagePath = getVehicleImagePath(normalized.make, normalized.model);

  if (!vehicle?.model && !vehicle?.plateNumber) {
    return (
      <p className="text-xs text-gray-500">Vehicle details pending</p>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${compact ? '' : 'mt-1'}`}>
      <div className="shrink-0 w-16 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden relative">
        <Image
          src={imagePath}
          alt={`${normalized.displayLabel} vehicle illustration`}
          fill
          className="object-contain p-1"
          sizes="64px"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Car className="h-4 w-4 text-gray-300 opacity-0" aria-hidden />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
          {normalized.color ? `${normalized.color} · ` : ''}{normalized.displayLabel}
        </p>
        {normalized.plateNumber && (
          <p className="text-xs font-mono tracking-wider text-gray-500 mt-0.5">
            {normalized.plateNumber}
          </p>
        )}
        {!compact && normalized.capacity && (
          <p className="text-xs text-gray-400">{normalized.capacity} seats</p>
        )}
        {showLegacyBadge && normalized.isLegacy && (
          <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block mt-1">
            Legacy vehicle record
          </p>
        )}
        <span className="sr-only">{formatVehicleDisplayLine(vehicle)}</span>
      </div>
    </div>
  );
}
