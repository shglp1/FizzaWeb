/**
 * Tracking visibility helpers — shared by API routes and client poll handling.
 */

import { isParentLocationVisible } from '../trips/tripLifecycle.ts';
import type { TripStatus } from '../trips/tripLifecycle.ts';

const TERMINAL_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED', 'NO_SHOW']);

export function isTerminalTripStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isParentTrackingVisible(
  status: string,
  scheduledPickupTime: Date | string | null,
  nowMs = Date.now(),
): boolean {
  const pickup =
    scheduledPickupTime instanceof Date
      ? scheduledPickupTime
      : scheduledPickupTime
      ? new Date(scheduledPickupTime)
      : null;
  return isParentLocationVisible(status as TripStatus, pickup, nowMs);
}

/** Whether a parent should receive live driver coordinates for this trip. */
export function parentCanSeeLiveLocation(
  status: string,
  scheduledPickupTime: Date | string | null,
  nowMs = Date.now(),
): boolean {
  if (isTerminalTripStatus(status)) return false;
  return isParentTrackingVisible(status, scheduledPickupTime, nowMs);
}
