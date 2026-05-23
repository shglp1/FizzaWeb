/**
 * Proximity + ETA notification triggers on driver location update.
 */
import { prisma } from '@/lib/prisma';
import { getTripOpsConfig } from './tripConfig';
import { calculateEtaMinutes, shouldTriggerNearEvent } from './tripEta';
import type { TripStatus } from './tripLifecycle';
import {
  notifyFiveMinutesToPickup,
  notifyFiveMinutesToDropoff,
  notifyNearPickup,
  notifyNearDropoff,
} from './tripNotifications';

type TripForProximity = {
  id: string;
  status: TripStatus;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  subscription: { userId: string } | null;
  rider: { parentId: string } | null;
  driver: { profileId: string | null } | null;
};

export async function processLocationProximityUpdate(
  trip: TripForProximity,
  lat: number,
  lng: number,
): Promise<void> {
  const config = await getTripOpsConfig();
  const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
  const driverProfileId = trip.driver?.profileId ?? null;
  const input = { tripId: trip.id, parentUserId, driverProfileId };

  const prePickup = ['DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY'].includes(trip.status);
  const postPickup = ['PICKED_UP', 'EN_ROUTE_DROPOFF'].includes(trip.status);

  if (prePickup && trip.pickupLat != null && trip.pickupLng != null) {
    const eta = await calculateEtaMinutes(lat, lng, trip.pickupLat, trip.pickupLng, config);
    if (shouldTriggerNearEvent(
      eta.etaMinutes, eta.distanceMeters,
      config.etaNearThresholdMinutes, config.pickupNearThresholdMeters,
    )) {
      await notifyFiveMinutesToPickup({ ...input, etaMinutes: Math.round(eta.etaMinutes) });
      await notifyNearPickup(input);
    }
  }

  if (postPickup && trip.dropoffLat != null && trip.dropoffLng != null) {
    const eta = await calculateEtaMinutes(lat, lng, trip.dropoffLat, trip.dropoffLng, config);
    if (shouldTriggerNearEvent(
      eta.etaMinutes, eta.distanceMeters,
      config.etaNearThresholdMinutes, config.dropoffNearThresholdMeters,
    )) {
      await notifyFiveMinutesToDropoff({ ...input, etaMinutes: Math.round(eta.etaMinutes) });
      await notifyNearDropoff(input);
    }
  }
}

/** Check if user has active chat block. */
export async function isUserChatBlocked(userId: string): Promise<boolean> {
  const now = new Date();
  const base = {
    active: true,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };

  const userBlock = await prisma.chatBlock.findFirst({
    where: {
      ...base,
      AND: [{ OR: [{ targetType: 'GLOBAL' }, { targetType: 'USER', userId }] }],
    },
    select: { id: true },
  });
  if (userBlock) return true;

  const driver = await prisma.driver.findFirst({
    where: { profileId: userId },
    select: { id: true },
  });
  if (!driver) return false;

  const driverBlock = await prisma.chatBlock.findFirst({
    where: { ...base, targetType: 'DRIVER', driverId: driver.id },
    select: { id: true },
  });
  return !!driverBlock;
}
