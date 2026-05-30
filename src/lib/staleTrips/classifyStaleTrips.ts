/**
 * Stale trip classification for audit and remediation tooling.
 */
import { isTripStaleNonTerminal } from '../time/businessTimezone.ts';

const ACTIVE = [
  'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP',
  'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
] as const;

export type StaleTripCategory =
  | 'old_needs_dispatch'
  | 'stale_non_terminal'
  | 'stuck_active'
  | 'pending_financial_review'
  | 'date_mismatch';

export function classifyStaleTripRow(trip: {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledPickupTime?: string | null;
  needsDispatch?: boolean;
  financialReviewStatus?: string | null;
  scheduledDateKey?: string;
  businessDateKey?: string;
}, todayStartIso: string): StaleTripCategory[] {
  const categories: StaleTripCategory[] = [];
  const scheduledBeforeToday = trip.scheduledDate.slice(0, 10) < todayStartIso.slice(0, 10);

  if (trip.financialReviewStatus === 'PENDING') {
    categories.push('pending_financial_review');
  }

  if (scheduledBeforeToday && trip.needsDispatch && trip.status === 'SCHEDULED') {
    categories.push('old_needs_dispatch');
  }

  if (
    scheduledBeforeToday
    && isTripStaleNonTerminal({
      status: trip.status,
      scheduledDate: trip.scheduledDate,
      scheduledPickupTime: trip.scheduledPickupTime ?? null,
    })
  ) {
    categories.push('stale_non_terminal');
  }

  if (scheduledBeforeToday && (ACTIVE as readonly string[]).includes(trip.status)) {
    categories.push('stuck_active');
  }

  if (
    trip.scheduledDateKey
    && trip.businessDateKey
    && trip.scheduledDateKey !== trip.businessDateKey
  ) {
    categories.push('date_mismatch');
  }

  return categories;
}

export function recommendedStaleAction(categories: StaleTripCategory[]): string {
  if (categories.includes('pending_financial_review')) {
    return 'Resolve in Financial Review — do not auto-close';
  }
  if (categories.includes('old_needs_dispatch') || categories.includes('stale_non_terminal')) {
    return 'Admin cancel or no-show with documented reason';
  }
  if (categories.includes('stuck_active')) {
    return 'Review trip status with driver/admin — may need cancel or complete with reason';
  }
  if (categories.includes('date_mismatch')) {
    return 'Verify scheduling data — future trips only affected by generation fix';
  }
  return 'Review manually';
}
