/**
 * Financial review helpers for stale/disputed trip completions.
 */

import { isTripStaleNonTerminal } from '../time/businessTimezone.ts';

export type FinancialReviewAction =
  | 'PAY_DRIVER'
  | 'NO_PAY_DRIVER'
  | 'REFUND_PARENT'
  | 'CREDIT_PARENT'
  | 'KEEP_REVENUE'
  | 'INCIDENT';

export const FINANCIAL_REVIEW_ACTIONS: FinancialReviewAction[] = [
  'PAY_DRIVER',
  'NO_PAY_DRIVER',
  'REFUND_PARENT',
  'CREDIT_PARENT',
  'KEEP_REVENUE',
  'INCIDENT',
];

export function shouldFlagFinancialReviewOnComplete(trip: {
  status: string;
  scheduledDate: Date | string;
  scheduledPickupTime?: Date | string | null;
  financialReviewStatus?: string | null;
}): boolean {
  if (trip.financialReviewStatus) return false;
  const scheduledDate = trip.scheduledDate instanceof Date
    ? trip.scheduledDate.toISOString()
    : String(trip.scheduledDate);
  const scheduledPickupTime = trip.scheduledPickupTime
    ? (trip.scheduledPickupTime instanceof Date ? trip.scheduledPickupTime.toISOString() : String(trip.scheduledPickupTime))
    : null;
  return isTripStaleNonTerminal({
    status: trip.status,
    scheduledDate,
    scheduledPickupTime,
  });
}
