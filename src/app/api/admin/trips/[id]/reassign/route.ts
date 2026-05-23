/**
 * PATCH /api/admin/trips/[id]/reassign
 * Reassign driver for a single trip with reason and conflict check.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import { notifyDriverAssigned } from '@/lib/trips/tripNotifications';
import { recordTripEventOnce } from '@/lib/trips/tripEvents';

const reassignSchema = z.object({
  driverId: z.string().uuid(),
  reason: z.string().min(3).max(500),
  applyToFuture: z.boolean().optional().default(false),
});

function getIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 });
    }

    const parsed = reassignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, { status: 400 });
    }

    const { driverId, reason, applyToFuture } = parsed.data;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { driver: { include: { profile: true } } },
    });
    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }
    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      return NextResponse.json({ data: null, error: { message: `Cannot reassign ${trip.status} trip` } }, { status: 400 });
    }

    const newDriver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true, profile: { select: { id: true, fullName: true } } },
    });
    if (!newDriver || newDriver.isSuspended || !newDriver.vehicleId) {
      return NextResponse.json({ data: null, error: { message: 'Driver unavailable or missing vehicle' } }, { status: 400 });
    }

    if (trip.scheduledPickupTime) {
      const conflict = await prisma.trip.findFirst({
        where: {
          id: { not: id },
          driverId,
          status: { notIn: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] },
          scheduledPickupTime: {
            gte: new Date(trip.scheduledPickupTime.getTime() - 30 * 60 * 1000),
            lte: new Date(trip.scheduledPickupTime.getTime() + 30 * 60 * 1000),
          },
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json({
          data: null,
          error: { message: 'Driver has a conflicting trip within 30 minutes' },
        }, { status: 409 });
      }
    }

    const oldDriverProfileId = trip.driver?.profile?.id ?? null;
    const updated = await prisma.trip.update({
      where: { id },
      data: {
        driverId,
        vehicleId: newDriver.vehicleId,
        status: trip.status === 'SCHEDULED' ? 'DRIVER_ASSIGNED' : trip.status,
        statusReason: reason,
      },
      include: {
        rider: { select: { name: true, parentId: true } },
        driver: { include: { profile: { select: { fullName: true } } } },
      },
    });

    let parentUserId: string | null = null;
    if (trip.subscriptionId) {
      const sub = await prisma.userSubscription.findUnique({
        where: { id: trip.subscriptionId },
        select: { userId: true },
      });
      parentUserId = sub?.userId ?? null;
    }
    parentUserId = parentUserId ?? updated.rider?.parentId ?? null;

    await recordTripEventOnce(id, 'DRIVER_REASSIGNED', `Driver reassigned: ${reason}`, {
      actorUserId: auth.userId,
      actorRole: 'ADMIN',
      metadata: { oldDriverId: trip.driverId, newDriverId: driverId, reason },
    });

    await notifyDriverAssigned({
      tripId: id,
      parentUserId,
      driverProfileId: newDriver.profile?.id ?? null,
      driverFullName: newDriver.profile?.fullName ?? 'Driver',
    });

    if (oldDriverProfileId) {
      await prisma.notification.create({
        data: {
          userId: oldDriverProfileId,
          title: 'Trip Reassigned',
          message: `Trip ${id.slice(0, 8)}… has been reassigned to another driver.`,
          type: 'TRIP',
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'TRIP_DRIVER_REASSIGNED',
        details: JSON.stringify({ tripId: id, driverId, reason, applyToFuture }),
        ipAddress: getIp(req),
      },
    });

    if (applyToFuture && trip.subscriptionId) {
      await prisma.userSubscription.update({
        where: { id: trip.subscriptionId },
        data: { assignedDriverId: driverId },
      });
    }

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
