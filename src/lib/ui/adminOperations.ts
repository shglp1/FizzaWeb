/**
 * Admin trip operations board grouping (pure, testable).
 */

import { isTripStaleNonTerminal } from '../time/businessTimezone.ts';

export type OpsColumnKey = 'scheduled' | 'active' | 'attention' | 'completed';

const ACTIVE = new Set([
  'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP',
  'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
]);

export function classifyTripForBoard(t: {
  status: string;
  scheduledDate?: string;
  scheduledPickupTime?: string | null;
  driver?: unknown | null;
  needsDispatch?: boolean;
}): OpsColumnKey {
  if (t.scheduledDate && isTripStaleNonTerminal(t as { status: string; scheduledDate: string; scheduledPickupTime?: string | null })) {
    return 'attention';
  }
  if (t.needsDispatch) return 'attention';
  if (t.status === 'COMPLETED') return 'completed';
  if (ACTIVE.has(t.status)) return 'active';
  if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status) && !t.driver) return 'attention';
  if (['CANCELLED', 'NO_SHOW'].includes(t.status)) return 'attention';
  if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status)) return 'scheduled';
  return 'active';
}
