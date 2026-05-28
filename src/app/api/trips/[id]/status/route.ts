import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { z } from 'zod';
import { isValidTransition, isChatWindowOpen, haversineMetres, DRIVER_TRANSITIONS } from '@/lib/trips/tripLifecycle';
import {
  notifyArrivedPickup,
  notifyRiderPickedUp,
  notifyArrivedDropoff,
  notifyCompleted,
  notifyCancelled,
  notifyLocationSharingStarted,
  notifyLocationSharingStopped,
  notifyChatOpened,
  notifyChatClosed,
  notifyNearPickup,
  notifyNearDropoff,
  recordStatusChange,
  recordContinuedWithoutGps,
} from '@/lib/trips/tripNotifications';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

const statusUpdateSchema = z.object({
  status: z.enum([
    'SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
    'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF',
    'ARRIVED_DROPOFF', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
  ]),
  statusReason: z.string().max(500).optional(),
  continuedWithoutGps: z.boolean().optional(),
  /** Current driver lat (for geofence-based notifications). */
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'DRIVER' && auth.role !== 'ADMIN') {
      return NextResponse.json({ data: null, error: { message: 'Only drivers or admins can update trip status' } }, { status: 403 });
    }

    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 });
    }

    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, { status: 400 });
    }

    const { status: newStatus, statusReason, continuedWithoutGps, lat, lng } = parsed.data;

    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        driverId: true,
        scheduledPickupTime: true,
        scheduledDropoffTime: true,
        chatOpenedAt: true,
        chatClosedAt: true,
        pickupLat: true, pickupLng: true,
        dropoffLat: true, dropoffLng: true,
        driver: { select: { profileId: true } },
        subscription: { select: { userId: true } },
        rider: { select: { parentId: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    // Driver access check
    if (auth.role === 'DRIVER' && trip.driver?.profileId !== auth.userId) {
      return NextResponse.json({ data: null, error: { message: 'Not your trip' } }, { status: 403 });
    }

    // Validate transition
    const role = auth.role as 'DRIVER' | 'ADMIN';
    if (!isValidTransition(trip.status as TripStatus, newStatus as TripStatus, role)) {
      return NextResponse.json({
        data: null,
        error: { message: `Invalid transition: ${trip.status} → ${newStatus}` },
      }, { status: 422 });
    }

    if (auth.role === 'ADMIN') {
      const driverAllowed = DRIVER_TRANSITIONS[trip.status as TripStatus] ?? [];
      const isAdminOverride = !driverAllowed.includes(newStatus as TripStatus);
      if (isAdminOverride && !statusReason?.trim()) {
        return NextResponse.json({
          data: null,
          error: { message: 'Admin override requires statusReason' },
        }, { status: 422 });
      }
    }

    const driverAllowed = DRIVER_TRANSITIONS[trip.status as TripStatus] ?? [];
    const isAdminOverride =
      auth.role === 'ADMIN' && !driverAllowed.includes(newStatus as TripStatus);

    if (newStatus === 'NO_SHOW' && !statusReason?.trim()) {
      return NextResponse.json({
        data: null,
        error: { message: 'No-show requires statusReason' },
      }, { status: 422 });
    }

    // Determine if chat should open
    const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
    const driverProfileId = trip.driver?.profileId ?? null;
    const notifInput = { tripId: id, parentUserId, driverProfileId };
    const shouldOpenChat = !trip.chatOpenedAt &&
      isChatWindowOpen(trip.scheduledPickupTime, newStatus as TripStatus, trip.chatOpenedAt, trip.chatClosedAt);

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: newStatus,
      statusReason: statusReason ?? null,
    };
    if (shouldOpenChat) updateData.chatOpenedAt = now;
    if (newStatus === 'PICKED_UP') updateData.actualPickupTime = now;
    if (newStatus === 'COMPLETED') updateData.actualDropoffTime = now;

    await prisma.trip.update({ where: { id }, data: updateData });

    if (shouldOpenChat) await notifyChatOpened(notifInput);

    await recordStatusChange(id, auth.userId, auth.role, trip.status, newStatus, {
      statusReason: statusReason ?? null,
      adminOverride: isAdminOverride,
    });

    if (
      auth.role === 'DRIVER' &&
      continuedWithoutGps &&
      auth.userId
    ) {
      await recordContinuedWithoutGps(id, auth.userId, auth.role, newStatus);
    }

    const statusNow = newStatus as TripStatus;
    if (statusNow === 'PRE_TRIP' || statusNow === 'ON_THE_WAY') {
      await notifyLocationSharingStarted(notifInput);
    } else if (statusNow === 'ARRIVED_PICKUP') {
      await notifyArrivedPickup(notifInput);
    } else if (statusNow === 'PICKED_UP') {
      await notifyRiderPickedUp(notifInput);
    } else if (statusNow === 'ARRIVED_DROPOFF') {
      await notifyArrivedDropoff(notifInput);
    } else if (statusNow === 'COMPLETED') {
      await notifyCompleted(notifInput);
      await notifyLocationSharingStopped({ ...notifInput, reason: 'Trip completed' });
    } else if (statusNow === 'CANCELLED' || statusNow === 'NO_SHOW') {
      await notifyCancelled({ ...notifInput, reason: statusReason, cancelledByRole: auth.role });
      await notifyLocationSharingStopped({ ...notifInput, reason: statusReason ?? statusNow });
    }

    // Geofence proximity check (if coordinates provided)
    if (lat !== undefined && lng !== undefined) {
      if (trip.pickupLat && trip.pickupLng) {
        const distToPickup = haversineMetres(lat, lng, trip.pickupLat, trip.pickupLng);
        if (distToPickup <= 200) {
          await notifyNearPickup(notifInput);
        }
      }
      if (trip.dropoffLat && trip.dropoffLng) {
        const distToDropoff = haversineMetres(lat, lng, trip.dropoffLat, trip.dropoffLng);
        if (distToDropoff <= 200) {
          await notifyNearDropoff(notifInput);
        }
      }
    }

    return NextResponse.json({ data: { id, status: newStatus }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
