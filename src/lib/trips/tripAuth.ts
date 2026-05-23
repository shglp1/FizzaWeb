/**
 * Pure authorization helpers for trip operations (testable without DB).
 */
import type { TripStatus } from './tripLifecycle.ts';
import { isValidTransition, isChatWindowOpen, isLocationSharingAllowed } from './tripLifecycle.ts';

export type TripAccessContext = {
  tripId: string;
  tripDriverProfileId: string | null;
  parentUserId: string | null;
  riderParentId: string | null;
  status: TripStatus;
  scheduledPickupTime: Date | null;
  chatOpenedAt: Date | null;
  chatClosedAt: Date | null;
  tripEndedAt: Date | null;
};

export function canParentAccessTrip(ctx: TripAccessContext, userId: string): boolean {
  return ctx.parentUserId === userId || ctx.riderParentId === userId;
}

export function canDriverAccessTrip(ctx: TripAccessContext, userId: string): boolean {
  return ctx.tripDriverProfileId === userId;
}

export function canDriverUpdateLocation(ctx: TripAccessContext, userId: string, nowMs = Date.now()): boolean {
  if (!canDriverAccessTrip(ctx, userId)) return false;
  return isLocationSharingAllowed(ctx.status, ctx.scheduledPickupTime, nowMs);
}

export function canSendChat(
  ctx: TripAccessContext,
  userId: string,
  role: string,
  chatBlocked: boolean,
  nowMs = Date.now(),
): { allowed: boolean; reason?: string } {
  if (chatBlocked && role !== 'ADMIN') {
    return { allowed: false, reason: 'CHAT_BLOCKED' };
  }
  if (role === 'ADMIN') return { allowed: true };
  if (role === 'DRIVER' && !canDriverAccessTrip(ctx, userId)) {
    return { allowed: false, reason: 'NOT_ASSIGNED_DRIVER' };
  }
  if (role !== 'DRIVER' && !canParentAccessTrip(ctx, userId)) {
    return { allowed: false, reason: 'NOT_PARENT' };
  }
  const open = isChatWindowOpen(
    ctx.scheduledPickupTime, ctx.status, ctx.chatOpenedAt, ctx.chatClosedAt, nowMs, ctx.tripEndedAt,
  );
  if (!open && role !== 'ADMIN') {
    return { allowed: false, reason: 'CHAT_CLOSED' };
  }
  return { allowed: true };
}

export function assertValidStatusTransition(
  from: TripStatus,
  to: TripStatus,
  role: 'DRIVER' | 'ADMIN' | 'PARENT',
): boolean {
  return isValidTransition(from, to, role);
}

/** Driver cannot complete before pickup. */
export function isCompleteBeforePickupAttempt(from: TripStatus, to: TripStatus): boolean {
  const prePickup = ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP'];
  return to === 'COMPLETED' && prePickup.includes(from);
}
