/**
 * Service-day rating eligibility — round-trip requires both legs COMPLETED.
 */

import { prisma } from '../prisma.ts';
import { getTripBusinessDateKey } from '../time/businessTimezone.ts';
import { BusinessError } from '../errors.ts';

export type RatingEligibility = {
  eligible: boolean;
  reason?: string;
  serviceDate?: string;
  existingRating?: { id: string; rating: number; comment: string | null } | null;
};

/** Round-trip subscriptions require both legs completed before rating. */
export function areRoundTripLegsComplete(legs: { legType: string; status: string }[]): boolean {
  const outboundDone = legs.some((l) => l.legType === 'OUTBOUND' && l.status === 'COMPLETED');
  const returnDone = legs.some((l) => l.legType === 'RETURN' && l.status === 'COMPLETED');
  return outboundDone && returnDone;
}

export async function checkRatingEligibility(tripId: string, parentId: string): Promise<RatingEligibility> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      legType: true,
      scheduledDate: true,
      scheduledPickupTime: true,
      riderId: true,
      driverId: true,
      subscriptionId: true,
      rider: { select: { parentId: true } },
      subscription: {
        select: {
          subscriptionType: true,
          tripDirection: true,
          userId: true,
        },
      },
    },
  });

  if (!trip || !trip.driverId || !trip.riderId) {
    return { eligible: false, reason: 'Trip not found or missing driver/rider' };
  }

  const ownerId = trip.subscription?.userId ?? trip.rider?.parentId;
  if (ownerId !== parentId) {
    return { eligible: false, reason: 'Not authorized' };
  }

  if (trip.status !== 'COMPLETED') {
    return { eligible: false, reason: 'Trip not completed yet' };
  }

  const serviceDateKey = getTripBusinessDateKey({
    scheduledDate: trip.scheduledDate.toISOString(),
    scheduledPickupTime: trip.scheduledPickupTime?.toISOString() ?? null,
  });
  const serviceDate = new Date(`${serviceDateKey}T12:00:00.000Z`);

  const existing = await prisma.tripRating.findUnique({
    where: {
      riderId_serviceDate_driverId: {
        riderId: trip.riderId,
        serviceDate,
        driverId: trip.driverId,
      },
    },
    select: { id: true, rating: true, comment: true },
  });

  if (existing) {
    return { eligible: false, reason: 'Already rated', serviceDate: serviceDateKey, existingRating: existing };
  }

  if (trip.subscription?.tripDirection === 'ROUND_TRIP') {
    const legs = await prisma.trip.findMany({
      where: {
        riderId: trip.riderId,
        driverId: trip.driverId,
        scheduledDate: serviceDate,
      },
      select: { legType: true, status: true },
    });
    if (!areRoundTripLegsComplete(legs)) {
      return {
        eligible: false,
        reason: 'Round-trip rating opens after both outbound and return legs are completed',
        serviceDate: serviceDateKey,
      };
    }
  }

  return { eligible: true, serviceDate: serviceDateKey };
}

export async function submitServiceDayRating(input: {
  tripId: string;
  parentId: string;
  rating: number;
  comment?: string;
}) {
  const eligibility = await checkRatingEligibility(input.tripId, input.parentId);
  if (!eligibility.eligible || !eligibility.serviceDate) {
    throw new BusinessError(eligibility.reason ?? 'Not eligible to rate');
  }

  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: input.tripId },
    select: { riderId: true, driverId: true, subscriptionId: true },
  });

  const serviceDate = new Date(`${eligibility.serviceDate}T12:00:00.000Z`);

  const created = await prisma.tripRating.create({
    data: {
      riderId: trip.riderId!,
      driverId: trip.driverId!,
      parentId: input.parentId,
      subscriptionId: trip.subscriptionId,
      serviceDate,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    },
  });

  const agg = await prisma.tripRating.aggregate({
    where: { driverId: trip.driverId! },
    _avg: { rating: true },
    _count: { rating: true },
  });

  if (agg._count.rating > 0 && agg._avg.rating != null) {
    await prisma.driver.update({
      where: { id: trip.driverId! },
      data: { rating: Math.round(agg._avg.rating * 10) / 10 },
    });
  }

  return created;
}
