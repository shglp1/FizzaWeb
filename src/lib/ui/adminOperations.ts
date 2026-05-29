/**
 * Admin trip operations board grouping (pure, testable).
 */

import { classifyTripForRole } from '../trips/tripClassification.ts';
import { getBusinessDateKey } from '../time/businessTimezone.ts';

export type OpsColumnKey = 'scheduled' | 'active' | 'attention' | 'completed';

export function classifyTripForBoard(t: {
  status: string;
  scheduledDate?: string;
  scheduledPickupTime?: string | null;
  driver?: unknown | null;
  needsDispatch?: boolean;
}): OpsColumnKey {
  if (!t.scheduledDate) {
    if (t.needsDispatch) return 'attention';
    if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status) && !t.driver) return 'attention';
    if (t.status === 'COMPLETED') return 'completed';
    if (['CANCELLED', 'NO_SHOW'].includes(t.status)) return 'attention';
    if (['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(t.status)) {
      return 'active';
    }
    return 'scheduled';
  }

  const c = classifyTripForRole(
    {
      status: t.status,
      scheduledDate: t.scheduledDate,
      scheduledPickupTime: t.scheduledPickupTime,
      needsDispatch: t.needsDispatch,
      driverId: t.driver ? 'assigned' : null,
    },
    { role: 'ADMIN' },
  );

  const todayKey = getBusinessDateKey(new Date());

  if (c.isStale || c.category === 'stale' || c.category === 'missed_pickup') return 'attention';
  if (t.needsDispatch && c.businessDateKey < todayKey) return 'attention';
  if (t.needsDispatch) return 'attention';
  if (c.category === 'completed') return 'completed';
  if (c.isActive) return 'active';
  if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status) && !t.driver) return 'attention';
  if (['CANCELLED', 'NO_SHOW'].includes(t.status)) return 'attention';
  if (['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status)) return 'scheduled';
  return 'active';
}
