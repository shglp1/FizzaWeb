/**
 * Subscription ↔ trip lifecycle — operational visibility and cancel coupling.
 */
import type { Prisma, SubscriptionStatus, TripStatus } from '@prisma/client';
import { prisma } from '../prisma.ts';

/** Subscriptions that may have live/upcoming trips shown to parent/driver. */
export const OPERATIONAL_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['ACTIVE'];

const TERMINAL_TRIP_STATUSES: TripStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function isOperationalSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}

/** Parent/driver list filters that show history — include inactive subscription trips. */
export function isHistoricalTripListFilter(statusFilter: string | null): boolean {
  return statusFilter === 'completed' || statusFilter === 'cancelled';
}

/** Prisma AND clause: non-terminal trips must belong to an ACTIVE subscription (or no subscription link). */
export function operationalSubscriptionTripFilter(): Prisma.TripWhereInput {
  return {
    OR: [
      { subscriptionId: null },
      { subscription: { status: { in: OPERATIONAL_SUBSCRIPTION_STATUSES } } },
    ],
  };
}

export function buildParentTripScope(input: {
  activeSubscriptionIds: string[];
  allSubscriptionIds: string[];
  riderIds: string[];
  statusFilter: string | null;
}): Prisma.TripWhereInput {
  const useHistory = isHistoricalTripListFilter(input.statusFilter);
  const subscriptionIds = useHistory ? input.allSubscriptionIds : input.activeSubscriptionIds;

  const orClauses: Prisma.TripWhereInput[] = [];
  if (subscriptionIds.length > 0) {
    orClauses.push({ subscriptionId: { in: subscriptionIds } });
  }
  if (input.riderIds.length > 0) {
    orClauses.push({ subscriptionId: null, riderId: { in: input.riderIds } });
  }
  if (orClauses.length === 0) {
    return { id: { in: [] } };
  }

  const scope: Prisma.TripWhereInput = { OR: orClauses };
  if (!useHistory) {
    return { AND: [scope, operationalSubscriptionTripFilter()] };
  }
  return scope;
}

export type CancelSubscriptionTripsResult = {
  cancelledCount: number;
  tripIds: string[];
  notifiedDriverProfileIds: string[];
};

/**
 * Cancel all non-terminal trips for a subscription (subscription cancel / reconcile).
 */
export async function cancelNonTerminalTripsForSubscription(
  tx: Prisma.TransactionClient,
  input: {
    subscriptionId: string;
    reason: string;
    cancelledByUserId: string;
    auditAction: string;
    subscriptionStatus: string;
  },
): Promise<CancelSubscriptionTripsResult> {
  const trips = await tx.trip.findMany({
    where: {
      subscriptionId: input.subscriptionId,
      status: { notIn: TERMINAL_TRIP_STATUSES },
    },
    select: {
      id: true,
      status: true,
      driver: { select: { profileId: true } },
    },
  });

  if (trips.length === 0) {
    return { cancelledCount: 0, tripIds: [], notifiedDriverProfileIds: [] };
  }

  const now = new Date();
  const statusReason = input.reason.trim();

  await tx.trip.updateMany({
    where: { id: { in: trips.map((t) => t.id) } },
    data: {
      status: 'CANCELLED',
      statusReason,
      cancelledBy: input.cancelledByUserId,
      chatClosedAt: now,
    },
  });

  await tx.auditLog.create({
    data: {
      userId: input.cancelledByUserId,
      action: input.auditAction,
      details: JSON.stringify({
        subscriptionId: input.subscriptionId,
        subscriptionStatus: input.subscriptionStatus,
        cancelledTripIds: trips.map((t) => t.id),
        cancelledCount: trips.length,
        reason: statusReason,
      }),
    },
  });

  const driverProfileIds = [
    ...new Set(trips.map((t) => t.driver?.profileId).filter(Boolean) as string[]),
  ];

  return {
    cancelledCount: trips.length,
    tripIds: trips.map((t) => t.id),
    notifiedDriverProfileIds: driverProfileIds,
  };
}

export async function notifySubscriptionTripsCancelled(input: {
  parentUserId: string;
  driverProfileIds: string[];
  cancelledCount: number;
  reason: string;
}): Promise<void> {
  if (input.cancelledCount <= 0) return;

  await prisma.notification.create({
    data: {
      userId: input.parentUserId,
      title: 'Trips cancelled',
      message: `${input.cancelledCount} trip(s) were cancelled because the subscription is no longer active. ${input.reason}`,
      type: 'TRIP',
    },
  });

  await Promise.all(
    input.driverProfileIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          title: 'Trips cancelled',
          message: `${input.cancelledCount} assigned trip(s) were cancelled due to subscription status change.`,
          type: 'TRIP',
        },
      }),
    ),
  );
}

/** Reconcile: cancel non-terminal trips tied to non-ACTIVE subscriptions. */
export async function reconcileInactiveSubscriptionTrips(input: {
  apply: boolean;
  actorUserId: string;
  reason: string;
}): Promise<{
  subscriptionsAffected: number;
  tripsWouldCancel: number;
  tripsCancelled: number;
  details: { subscriptionId: string; status: string; tripIds: string[] }[];
}> {
  const inactiveSubs = await prisma.userSubscription.findMany({
    where: { status: { notIn: OPERATIONAL_SUBSCRIPTION_STATUSES } },
    select: { id: true, status: true, userId: true },
  });

  const details: { subscriptionId: string; status: string; tripIds: string[] }[] = [];
  let tripsWouldCancel = 0;
  let tripsCancelled = 0;

  for (const sub of inactiveSubs) {
    const trips = await prisma.trip.findMany({
      where: {
        subscriptionId: sub.id,
        status: { notIn: TERMINAL_TRIP_STATUSES },
      },
      select: { id: true, driver: { select: { profileId: true } } },
    });
    if (trips.length === 0) continue;

    details.push({
      subscriptionId: sub.id,
      status: sub.status,
      tripIds: trips.map((t) => t.id),
    });
    tripsWouldCancel += trips.length;

    if (input.apply) {
      const result = await prisma.$transaction(async (tx) =>
        cancelNonTerminalTripsForSubscription(tx, {
          subscriptionId: sub.id,
          reason: input.reason,
          cancelledByUserId: input.actorUserId,
          auditAction: 'SUBSCRIPTION_TRIPS_RECONCILED',
          subscriptionStatus: sub.status,
        }),
      );
      tripsCancelled += result.cancelledCount;

      const driverIds = result.notifiedDriverProfileIds;
      await notifySubscriptionTripsCancelled({
        parentUserId: sub.userId,
        driverProfileIds: driverIds,
        cancelledCount: result.cancelledCount,
        reason: input.reason,
      });
    }
  }

  return {
    subscriptionsAffected: details.length,
    tripsWouldCancel,
    tripsCancelled,
    details,
  };
}
