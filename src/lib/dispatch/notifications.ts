/**
 * Dispatch-related notifications for parents, drivers, and admins.
 */
import { randomUUID } from 'crypto';
import { prisma } from '../prisma';
import { shouldNotifyGenerationReport } from './idempotency';
import { notifyDriverAssigned } from '../trips/tripNotifications';
import { recordTripEventOnce } from '../trips/tripEvents';

async function notifyUser(userId: string | null, title: string, message: string, type: string) {
  if (!userId) return;
  await prisma.notification.create({
    data: { id: randomUUID(), userId, title, message, type },
  });
}

async function notifyAllAdmins(title: string, message: string, type: string) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  await Promise.all(admins.map((a) => notifyUser(a.id, title, message, type)));
}

export async function notifyTripNeedsDispatch(input: {
  tripId: string;
  scheduledDate: Date;
  scheduledPickupTime: Date | null;
  parentUserId: string | null;
  dispatchNote: string;
  urgent: boolean;
}): Promise<void> {
  const eventType = input.urgent ? 'DISPATCH_URGENT' : 'DISPATCH_NEEDED';
  const first = await recordTripEventOnce(
    input.tripId,
    eventType,
    input.dispatchNote,
    { actorRole: 'SYSTEM' },
  );
  if (!first) return;

  const dateLabel = input.scheduledDate.toLocaleDateString('en-SA', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = input.scheduledPickupTime
    ? input.scheduledPickupTime.toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' })
    : '';

  await notifyAllAdmins(
    input.urgent ? 'Urgent: trip needs dispatch' : 'Trip needs dispatch',
    `Trip on ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ''} requires driver assignment. ${input.dispatchNote}`,
    'DISPATCH',
  );

  if (input.urgent && input.parentUserId) {
    await notifyUser(
      input.parentUserId,
      'Driver confirmation in progress',
      `We are finalizing your driver for the trip on ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ''}. You will be notified once confirmed.`,
      'TRIP',
    );
  }
}

export async function notifyGenerationReport(input: {
  generatedCount: number;
  confirmedCount: number;
  needsDispatchCount: number;
  skippedCount: number;
  startDate: string;
  endDate: string;
  triggeredBy: 'CRON' | 'ADMIN' | 'PAYMENT';
}): Promise<void> {
  if (!shouldNotifyGenerationReport(input)) return;

  await notifyAllAdmins(
    'Trip generation complete',
    `${input.generatedCount} trips created (${input.confirmedCount} confirmed, ${input.needsDispatchCount} need dispatch, ${input.skippedCount} skipped) for ${input.startDate} – ${input.endDate}. Source: ${input.triggeredBy}.`,
    'DISPATCH',
  );
}

export async function notifyConfirmedTripAssignments(
  tripIds: string[],
): Promise<void> {
  if (tripIds.length === 0) return;

  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds } },
    select: {
      id: true,
      scheduledDate: true,
      scheduledPickupTime: true,
      pickupLocation: true,
      driver: {
        select: {
          id: true,
          profile: { select: { id: true, fullName: true } },
        },
      },
      subscription: { select: { userId: true } },
      rider: { select: { parentId: true, name: true } },
    },
  });

  for (const trip of trips) {
    if (!trip.driver?.profile) continue;
    const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
    await notifyDriverAssigned({
      tripId: trip.id,
      parentUserId,
      driverProfileId: trip.driver.profile.id,
      driverFullName: trip.driver.profile.fullName,
    });
  }
}

export async function notifySubscriptionDriverAssigned(input: {
  subscriptionId: string;
  parentUserId: string;
  driverFullName: string;
  conflictCount: number;
}): Promise<void> {
  await notifyUser(
    input.parentUserId,
    'Default driver assigned',
    input.conflictCount > 0
      ? `${input.driverFullName} is your default driver. Some upcoming trips need admin dispatch before confirmation.`
      : `${input.driverFullName} is your default driver. Upcoming trips will be confirmed automatically when feasible.`,
    'SUBSCRIPTION',
  );

  if (input.conflictCount > 0) {
    await notifyAllAdmins(
      'Subscription driver has dispatch conflicts',
      `${input.conflictCount} upcoming trip(s) for subscription ${input.subscriptionId} need dispatch after driver assignment.`,
      'DISPATCH',
    );
  }
}
