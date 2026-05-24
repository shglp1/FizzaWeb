'use client';

import { MapPin, Users, CalendarDays, CreditCard, Route } from 'lucide-react';
import { EnterpriseCard, InfoRow } from '@/components/ui/enterprise';
import type { SelectedLocation } from '@/components/location/MapLocationPicker';

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
  return (
    <EnterpriseCard
      accent
      className={compact ? '' : 'lg:sticky lg:top-6'}
      header={
        <div>
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Your plan</p>
          <p className="text-lg font-bold text-gray-900 mt-0.5">Subscription summary</p>
        </div>
      }
      padding="none"
    >
      <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
        <dl className="space-y-1">
          <InfoRow
            label="Plan"
            value={packageName ?? (step > 0 ? 'Custom pricing' : 'Not selected')}
          />
          {riderNames.length > 0 && (
            <InfoRow
              label="Riders"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                  {riderNames.join(', ')}
                </span>
              }
            />
          )}
          {weekdaysLabel && (
            <InfoRow
              label="Schedule"
              value={
                <span className="inline-flex items-start gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" aria-hidden />
                  <span>
                    {weekdaysLabel}
                    {serviceDaysCount > 0 && (
                      <span className="block text-xs font-normal text-gray-500 mt-0.5">
                        {serviceDaysCount} service days in billing period
                      </span>
                    )}
                  </span>
                </span>
              }
            />
          )}
          {(pickup || dropoff) && (
            <InfoRow
              label="Route"
              value={
                <span className="inline-flex items-start gap-1.5">
                  <Route className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" aria-hidden />
                  <span className="leading-snug">
                    {pickup?.label ?? 'Pickup TBD'}
                    <span className="text-emerald-600 mx-1">→</span>
                    {dropoff?.label ?? 'Drop-off TBD'}
                    <span className="block text-xs font-normal text-gray-500 mt-1">
                      {tripDirection === 'ROUND_TRIP' ? 'Round trip' : 'One way'}
                      {pickupTime && ` · Pickup ${pickupTime}`}
                      {tripDirection === 'ROUND_TRIP' && returnTime && ` · Return ${returnTime}`}
                    </span>
                  </span>
                </span>
              }
            />
          )}
          {addOnLabels.length > 0 && (
            <InfoRow label="Add-ons" value={addOnLabels.join(', ')} />
          )}
        </dl>

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
          {quoteLoading ? (
            <div className="space-y-2" role="status">
              <p className="text-sm font-medium text-emerald-800">Calculating route distance and price…</p>
              <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full w-1/2 bg-emerald-500 animate-pulse rounded-full" />
              </div>
            </div>
          ) : quote ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Estimated total</span>
                <span className="text-2xl font-bold text-emerald-800">
                  SAR {quote.finalPriceSar.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {quote.oneWayDistanceKm} km one-way · {quote.actualServiceDays} service days
              </p>
              <p className="text-xs text-emerald-700 mt-2">
                Distance is calculated across all selected service days, not only one trip.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              {step >= 3
                ? 'Complete route details and calculate price to see your total.'
                : 'Your estimate will appear here as you complete each step.'}
            </p>
          )}
        </div>

        {quote && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <CreditCard className="h-3 w-3" aria-hidden />
            Payment is collected after you confirm on the final step.
          </p>
        )}
      </div>
    </EnterpriseCard>
  );
}
