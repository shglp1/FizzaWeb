/**
 * Trip notification helpers (Task 12F).
 *
 * Each function creates Notification records in the DB.
 * Uses TripEvent deduplication to avoid sending the same notification twice.
 *
 * IMPORTANT: Import prisma from '@/lib/prisma' — do NOT import server-only
 * modules at the top level here; this file is meant for server-side use only.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function toTripEventMetadata(
  metadata?: Record<string, string | number | boolean | null>,
): Prisma.InputJsonValue | undefined {
  if (metadata === undefined) return undefined;
  return metadata as Prisma.InputJsonValue;
}

type NotifyInput = {
  tripId: string;
  parentUserId: string | null;
  driverProfileId: string | null;
};

/**
 * Record a TripEvent if one of the same type doesn't already exist for this trip.
 * Returns true if the event was created (first time), false if deduplicated.
 */
async function recordEvent(
  tripId: string,
  eventType: string,
  actorUserId: string | null,
  actorRole: string | null,
  message: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<boolean> {
  const existing = await prisma.tripEvent.findFirst({
    where: { tripId, eventType },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.tripEvent.create({
    data: {
      tripId,
      eventType,
      actorUserId,
      actorRole,
      message,
      metadata: toTripEventMetadata(metadata),
    },
  });
  return true;
}

async function notify(
  userId: string | null,
  title: string,
  message: string,
  type: string,
): Promise<void> {
  if (!userId) return;
  await prisma.notification.create({
    data: { userId, title, message, type },
  });
}

// ─── Notification triggers ────────────────────────────────────────────────────

/** Notify when a driver is assigned to a trip. */
export async function notifyDriverAssigned(
  input: NotifyInput & { driverFullName: string },
): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'DRIVER_ASSIGNED',
    input.driverProfileId, 'DRIVER',
    `Driver ${input.driverFullName} assigned to trip ${input.tripId}`,
  );
  if (!first) return;

  await Promise.all([
    notify(
      input.parentUserId,
      'Driver Assigned',
      `${input.driverFullName} has been assigned to your trip.`,
      'TRIP',
    ),
    notify(
      input.driverProfileId,
      'New Trip Assigned',
      'You have a new trip assignment. Check your schedule.',
      'TRIP',
    ),
  ]);
}

/** Notify when driver starts sharing location (PRE_TRIP or ON_THE_WAY). */
export async function notifyLocationSharingStarted(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'LOCATION_SHARING_STARTED',
    input.driverProfileId, 'DRIVER',
    'Driver started sharing location',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Driver Heading Your Way',
    'Your driver has started sharing their location.',
    'TRIP',
  );
}

/** Notify when driver is ~5 minutes from pickup (near pickup). */
export async function notifyNearPickup(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'NEAR_PICKUP',
    null, null,
    'Driver is near pickup location',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Driver Nearby',
    'Your driver is about 5 minutes away from the pickup point.',
    'TRIP',
  );
}

/** Notify when driver arrived at pickup. */
export async function notifyArrivedPickup(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'ARRIVED_PICKUP',
    input.driverProfileId, 'DRIVER',
    'Driver arrived at pickup',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Driver Has Arrived',
    'Your driver has arrived at the pickup location. Please head out.',
    'TRIP',
  );
}

/** Notify when rider is picked up. */
export async function notifyRiderPickedUp(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'RIDER_PICKED_UP',
    input.driverProfileId, 'DRIVER',
    'Rider picked up',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Rider Picked Up',
    'Your rider has been picked up and is on the way to the destination.',
    'TRIP',
  );
}

/** Notify when driver is ~5 minutes from drop-off. */
export async function notifyNearDropoff(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'NEAR_DROPOFF',
    null, null,
    'Driver is near drop-off location',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Almost at Destination',
    'Your rider is about 5 minutes away from the drop-off point.',
    'TRIP',
  );
}

/** Notify when driver arrived at drop-off. */
export async function notifyArrivedDropoff(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'ARRIVED_DROPOFF',
    input.driverProfileId, 'DRIVER',
    'Driver arrived at drop-off',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Arrived at Destination',
    'Your rider has arrived at the drop-off location.',
    'TRIP',
  );
}

/** Notify when trip is completed. */
export async function notifyCompleted(input: NotifyInput): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'COMPLETED',
    input.driverProfileId, 'DRIVER',
    'Trip completed',
  );
  if (!first) return;

  await notify(
    input.parentUserId,
    'Trip Completed',
    'The trip has been completed successfully.',
    'TRIP',
  );
}

/** Notify when driver is late (no arrival after driverLateAfterMinutes). */
export async function notifyDriverLate(
  input: NotifyInput & { adminUserId?: string | null },
): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'DRIVER_LATE',
    null, null,
    'Driver is late for pickup',
  );
  if (!first) return;

  await Promise.all([
    notify(
      input.parentUserId,
      'Driver Delay',
      'Your driver is running late. We are monitoring the situation.',
      'TRIP',
    ),
    input.adminUserId
      ? notify(input.adminUserId, 'Driver Late Alert', `Trip ${input.tripId}: driver has not arrived within the expected time.`, 'ALERT')
      : Promise.resolve(),
  ]);
}

/** Notify when rider is late or no-show. */
export async function notifyRiderLate(
  input: NotifyInput & { reason?: string; adminUserId?: string | null },
): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'RIDER_LATE',
    input.driverProfileId, 'DRIVER',
    `Rider late: ${input.reason ?? 'no reason given'}`,
  );
  if (!first) return;

  await Promise.all([
    notify(
      input.parentUserId,
      'Please Head Out',
      'Your driver is waiting. Please ensure your rider is ready.',
      'TRIP',
    ),
    input.adminUserId
      ? notify(input.adminUserId, 'Rider Late', `Trip ${input.tripId}: driver reports rider is not ready.`, 'ALERT')
      : Promise.resolve(),
  ]);
}

/** Notify on trip cancellation. */
export async function notifyCancelled(
  input: NotifyInput & { reason?: string; cancelledByRole: string },
): Promise<void> {
  const first = await recordEvent(
    input.tripId, 'CANCELLED',
    null, input.cancelledByRole,
    `Trip cancelled: ${input.reason ?? 'no reason'}`,
  );
  if (!first) return;

  const msg = input.reason
    ? `Your trip has been cancelled. Reason: ${input.reason}`
    : 'Your trip has been cancelled.';

  await Promise.all([
    notify(input.parentUserId, 'Trip Cancelled', msg, 'TRIP'),
    notify(input.driverProfileId, 'Trip Cancelled', `Trip ${input.tripId} has been cancelled.`, 'TRIP'),
  ]);
}

/** Notify when a chat message is flagged by moderation. */
export async function notifyMessageFlagged(
  input: { tripId: string; adminUserId: string | null; messagePreview: string },
): Promise<void> {
  if (!input.adminUserId) return;
  await notify(
    input.adminUserId,
    'Chat Message Flagged',
    `A message in trip ${input.tripId} was flagged: "${input.messagePreview.slice(0, 80)}"`,
    'MODERATION',
  );
}

/**
 * Record a generic status change event (always — not deduplicated by type since
 * status can change multiple times, deduplication is handled by the tripId+eventType combo).
 */
export async function recordStatusChange(
  tripId: string,
  actorUserId: string | null,
  actorRole: string,
  fromStatus: string,
  toStatus: string,
): Promise<void> {
  await prisma.tripEvent.create({
    data: {
      tripId,
      actorUserId,
      actorRole,
      eventType: 'STATUS_CHANGED',
      message: `Status changed: ${fromStatus} → ${toStatus}`,
      metadata: toTripEventMetadata({ from: fromStatus, to: toStatus }),
    },
  });
}
