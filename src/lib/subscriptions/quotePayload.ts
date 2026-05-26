/** Pure helpers for subscription quote requests — testable without Next.js. */

import type { ZodIssue } from 'zod';
import type { SelectedLocation } from '../location/stableMapPickerHelpers';

export type QuoteLocationPayload = {
  label: string;
  latitude: number;
  longitude: number;
};

export type SubscriptionQuoteRequestPayload = {
  packageId?: string;
  addOnIds: string[];
  pickupLocation: QuoteLocationPayload;
  dropoffLocation: QuoteLocationPayload;
  tripDirection: 'ONE_WAY' | 'ROUND_TRIP';
  riderIds: string[];
  weekdays: number[];
  startsOn?: string;
  promoCode?: string;
  loyaltyPointsToRedeem: number;
};

type LocationLike =
  | SelectedLocation
  | { label: string; lat: number; lng: number; photoUrl?: string | null }
  | null
  | undefined;

/** Normalize picker state (latitude/longitude or lat/lng) into quote API shape. */
export function normalizeQuoteLocation(value: LocationLike): QuoteLocationPayload | null {
  if (!value || typeof value !== 'object') return null;

  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const latitude =
    'latitude' in value && typeof value.latitude === 'number'
      ? value.latitude
      : 'lat' in value && typeof value.lat === 'number'
        ? value.lat
        : NaN;
  const longitude =
    'longitude' in value && typeof value.longitude === 'number'
      ? value.longitude
      : 'lng' in value && typeof value.lng === 'number'
        ? value.lng
        : NaN;

  if (!label || label.length < 3) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { label, latitude, longitude };
}

export function buildSubscriptionQuotePayload(input: {
  packageId: string | null;
  addOnIds: string[];
  pickupLocation: LocationLike;
  dropoffLocation: LocationLike;
  tripDirection: 'ONE_WAY' | 'ROUND_TRIP';
  riderIds: string[];
  weekdays: number[];
  startsOn: string;
  promoCode: string;
  loyaltyPointsToRedeem: number;
}): { ok: true; payload: SubscriptionQuoteRequestPayload } | { ok: false; message: string } {
  const pickup = normalizeQuoteLocation(input.pickupLocation);
  const dropoff = normalizeQuoteLocation(input.dropoffLocation);

  if (!pickup || !dropoff) {
    return {
      ok: false,
      message: 'Please confirm both pickup and drop-off locations on the map.',
    };
  }

  if (input.riderIds.length === 0) {
    return {
      ok: false,
      message: 'Please select at least one rider before calculating price.',
    };
  }

  return {
    ok: true,
    payload: {
      packageId: input.packageId ?? undefined,
      addOnIds: input.addOnIds,
      pickupLocation: pickup,
      dropoffLocation: dropoff,
      tripDirection: input.tripDirection,
      riderIds: input.riderIds,
      weekdays: input.weekdays,
      startsOn: input.startsOn || undefined,
      promoCode: input.promoCode.trim() || undefined,
      loyaltyPointsToRedeem: Number(input.loyaltyPointsToRedeem) || 0,
    },
  };
}

/** Map Zod/API validation messages to parent-friendly copy. */
export function mapQuoteValidationError(message: string, issues?: ZodIssue[]): string {
  const joined = [
    message,
    ...(issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`),
  ]
    .join(' ')
    .toLowerCase();

  if (
    joined.includes('pickuplocation') ||
    joined.includes('dropofflocation') ||
    joined.includes('latitude') ||
    joined.includes('longitude') ||
    joined.includes('location label')
  ) {
    return 'Please confirm both pickup and drop-off locations on the map.';
  }

  if (joined.includes('rider')) {
    return 'Please select at least one rider before calculating price.';
  }

  if (joined.includes('promo')) {
    return message || 'This promo code is not valid for your subscription.';
  }

  if (joined.includes('loyalty') || joined.includes('points')) {
    return message || 'Adjust loyalty points and try again.';
  }

  return message || 'Could not calculate price. Please check your selections and try again.';
}
