/**
 * Server-side trip list filters using the shared classification engine.
 */

import {
  classifyTripForRole,
  type ClassifiableTrip,
} from './tripClassification.ts';
import { getBusinessDateKey } from '../time/businessTimezone.ts';

/** Max rows fetched before in-memory classification filter (parent/driver upcoming/active). */
export const CLASSIFICATION_FETCH_CAP = 500;

export function toClassifiableTrip(trip: {
  status: string;
  scheduledDate: Date | string;
  scheduledPickupTime?: Date | string | null;
  needsDispatch?: boolean;
  driverId?: string | null;
  financialReviewStatus?: string | null;
}): ClassifiableTrip {
  const scheduledDate = trip.scheduledDate instanceof Date
    ? trip.scheduledDate.toISOString().slice(0, 10)
    : String(trip.scheduledDate).slice(0, 10);
  const scheduledPickupTime = trip.scheduledPickupTime
    ? (trip.scheduledPickupTime instanceof Date
      ? trip.scheduledPickupTime.toISOString()
      : String(trip.scheduledPickupTime))
    : null;
  return {
    status: trip.status,
    scheduledDate,
    scheduledPickupTime,
    needsDispatch: trip.needsDispatch,
    driverId: trip.driverId,
    financialReviewStatus: trip.financialReviewStatus,
  };
}

/** Riyadh business-day floor for parent/driver operational trip queries. */
export function riyadhTodayDateFloor(): Date {
  const todayKey = getBusinessDateKey(new Date());
  return new Date(`${todayKey}T00:00:00.000Z`);
}

export function filterTripsForRoleApi<T extends {
  status: string;
  scheduledDate: Date | string;
  scheduledPickupTime?: Date | string | null;
  needsDispatch?: boolean;
  driverId?: string | null;
  financialReviewStatus?: string | null;
}>(
  trips: T[],
  options: { role: 'PARENT' | 'DRIVER'; statusFilter: string | null; excludeStale?: boolean },
): T[] {
  const classifiable = trips.map((t) => ({ raw: t, c: toClassifiableTrip(t) }));
  const excludeStale = options.excludeStale ?? ['upcoming', 'active'].includes(options.statusFilter ?? '');

  let filtered = classifiable;
  if (excludeStale) {
    filtered = classifiable.filter((x) => {
      const c = classifyTripForRole(x.c, { role: options.role === 'DRIVER' ? 'DRIVER' : 'PARENT' });
      return !c.isStale && c.category !== 'stale' && c.category !== 'missed_pickup';
    });
  }

  if (options.statusFilter === 'active') {
    return filtered
      .filter((x) => classifyTripForRole(x.c, { role: options.role === 'DRIVER' ? 'DRIVER' : 'PARENT' }).isActive)
      .map((x) => x.raw);
  }

  if (options.statusFilter === 'upcoming') {
    return filtered
      .filter((x) => {
        const c = classifyTripForRole(x.c, { role: options.role === 'DRIVER' ? 'DRIVER' : 'PARENT' });
        return !c.isActive && c.shouldShowInUpcoming && !c.isTerminal;
      })
      .map((x) => x.raw);
  }

  if (options.statusFilter === 'review') {
    return classifiable
      .filter((x) => {
        const c = classifyTripForRole(x.c, { role: options.role === 'DRIVER' ? 'DRIVER' : 'PARENT' });
        return c.isStale || c.category === 'stale' || c.category === 'missed_pickup'
          || c.trackingGroup === 'needs_review';
      })
      .map((x) => x.raw);
  }

  return filtered.map((x) => x.raw);
}

export function needsClassificationFilter(role: string, statusFilter: string | null): boolean {
  return (role === 'PARENT' || role === 'DRIVER')
    && ['upcoming', 'active', 'review'].includes(statusFilter ?? '');
}
