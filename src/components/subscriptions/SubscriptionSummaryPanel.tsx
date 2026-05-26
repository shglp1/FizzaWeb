'use client';

import { MapPin, Users, CalendarDays, CreditCard } from 'lucide-react';
import { EnterpriseCard } from '@/components/ui/enterprise';
import { RouteDisplay } from '@/components/subscriptions/RouteDisplay';
import { SummaryInfoRow } from '@/components/subscriptions/SummaryRows';
import type { SelectedLocation } from '@/lib/location/stableMapPickerHelpers';

type TripDirection = 'ONE_WAY' | 'ROUND_TRIP';

type QuotePreview = {
  finalPriceSar: number;
  oneWayDistanceKm: number;
  actualServiceDays: number;
  normalizedPickupLabel: string;
  normalizedDropoffLabel: string;
} | null;

type Props = {
  step: number;
  packageName: string | null;
  riderNames: string[];
  weekdaysLabel: string;
  serviceDaysCount: number;
  pickup: SelectedLocation | null;
  dropoff: SelectedLocation | null;
  tripDirection: TripDirection;
  pickupTime: string;
  returnTime: string;
  addOnLabels: string[];
  quote: QuotePreview;
  quoteLoading: boolean;
  compact?: boolean;
};

export function SubscriptionSummaryPanel({
  step,
  packageName,
  riderNames,
  weekdaysLabel,
  serviceDaysCount,
  pickup,
  dropoff,
  tripDirection,
  pickupTime,
  returnTime,
  addOnLabels,
  quote,
  quoteLoading,
  compact = false,
}: Props) {
  const pickupLabel = quote?.normalizedPickupLabel ?? pickup?.label ?? 'Pickup TBD';
  const dropoffLabel = quote?.normalizedDropoffLabel ?? dropoff?.label ?? 'Drop-off TBD';

  return (
    <EnterpriseCard
      accent
      className={[
        compact ? '!rounded-none !border-0 !ring-0 !shadow-none' : '',
        !compact ? 'lg:sticky lg:top-6' : '',
      ].join(' ')}
      header={
        <div className="space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide leading-none">Your plan</p>
          <p className={`font-bold text-gray-900 leading-tight ${compact ? 'text-base' : 'text-lg'}`}>
            Subscription summary
          </p>
        </div>
      }
      padding="none"
    >
      <div className="space-y-3">
        <dl>
          <SummaryInfoRow
            label="Plan"
            value={packageName ?? (step > 0 ? 'Custom pricing' : 'Not selected')}
          />
          {riderNames.length > 0 && (
            <SummaryInfoRow
              label="Riders"
              value={
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
                  {riderNames.join(', ')}
                </span>
              }
            />
          )}
          {weekdaysLabel && (
            <SummaryInfoRow
              label="Schedule"
              value={
                <span className="block">
                  <span className="inline-flex items-start gap-2">
                    <CalendarDays className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" aria-hidden />
                    <span>{weekdaysLabel}</span>
                  </span>
                  {serviceDaysCount > 0 && (
                    <span className="block text-xs font-normal text-gray-500 mt-1.5 ps-6">
                      {serviceDaysCount} service days in billing period
                    </span>
                  )}
                </span>
              }
            />
          )}
          {(pickup || dropoff || quote) && (
            <SummaryInfoRow
              label="Route"
              value={
                <div className="space-y-2">
                  <RouteDisplay
                    pickupLabel={pickupLabel}
                    dropoffLabel={dropoffLabel}
                    compact={compact}
                  />
                  <p className="text-xs text-gray-500">
                    {tripDirection === 'ROUND_TRIP' ? 'Round trip' : 'One way'}
                    {pickupTime && ` · Pickup ${pickupTime}`}
                    {tripDirection === 'ROUND_TRIP' && returnTime && ` · Return ${returnTime}`}
                  </p>
                </div>
              }
            />
          )}
          {addOnLabels.length > 0 && (
            <SummaryInfoRow label="Add-ons" value={addOnLabels.join(', ')} />
          )}
        </dl>

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5 sm:p-4">
          {quoteLoading ? (
            <div className="space-y-2" role="status">
              <p className="text-sm font-medium text-emerald-800">Calculating route distance and price…</p>
              <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full w-1/2 bg-emerald-500 animate-pulse rounded-full" />
              </div>
            </div>
          ) : quote ? (
            <>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <span className="text-sm text-gray-600">Estimated total</span>
                <span className="text-2xl font-bold text-emerald-800 tabular-nums">
                  SAR {quote.finalPriceSar.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                {quote.oneWayDistanceKm} km one-way · {quote.actualServiceDays} service days
              </p>
              <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                Distance is calculated across all selected service days, not only one trip.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">
              {step >= 3
                ? 'Complete route details and calculate price to see your total.'
                : 'Your estimate will appear here as you complete each step.'}
            </p>
          )}
        </div>

        {quote && (
          <p className="text-xs text-gray-400 flex items-start gap-1.5 leading-relaxed">
            <CreditCard className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            Payment is collected after you confirm on the final step.
          </p>
        )}
      </div>
    </EnterpriseCard>
  );
}
