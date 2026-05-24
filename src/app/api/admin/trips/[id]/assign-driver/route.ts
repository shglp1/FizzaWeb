import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { driverAssignSchema } from '@/lib/validations/trip';
import { notifyDriverAssigned } from '@/lib/trips/tripNotifications';
import { getDispatchConfig } from '@/lib/dispatch/config';
import { decideTripDispatch } from '@/lib/dispatch/generateTrips';
import type { TimelineTrip } from '@/lib/dispatch/types';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const body = await req.json();
    const parsed = driverAssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { driverId } = parsed.data;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip not found' } },
        { status: 404 },
      );
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      return NextResponse.json(
        { data: null, error: { message: `Cannot assign driver to a ${trip.status} trip` } },
        { status: 400 },
      );
    }

    // Validate driver — must not be suspended, must have a vehicle
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true, profile: { select: { id: true, fullName: true } } },
    });

    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver not found' } },
        { status: 404 },
      );
    }

    if (driver.isSuspended) {
      return NextResponse.json(
        { data: null, error: { message: 'Cannot assign a suspended driver' } },
        { status: 400 },
      );
    }

    if (!driver.vehicleId || !driver.vehicle) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver does not have an assigned vehicle' } },
        { status: 400 },
      );
    }

    const config = await getDispatchConfig();
    const candidate: TimelineTrip = {
      id: trip.id,
      scheduledPickupTime: trip.scheduledPickupTime,
      scheduledDropoffTime: trip.scheduledDropoffTime,
      pickupLat: trip.pickupLat,
      pickupLng: trip.pickupLng,
      dropoffLat: trip.dropoffLat,
      dropoffLng: trip.dropoffLng,
    };
    const decision = await decideTripDispatch({
      candidate,
      driverId,
      scheduledDate: trip.scheduledDate,
      driverDayCache: new Map(),
      config,
    });

    if (!decision.assignDriver) {
      return NextResponse.json(
        { data: null, error: { message: decision.dispatchNote ?? 'Driver timeline conflict — choose another driver or adjust schedule' } },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.trip.update({
        where: { id },
        data: {
          driverId,
          vehicleId: driver.vehicleId,
          status: trip.status === 'SCHEDULED' ? 'DRIVER_ASSIGNED' : trip.status,
          needsDispatch: false,
          dispatchNote: null,
        },
        include: {
          rider: { select: { name: true } },
          driver: { include: { profile: { select: { fullName: true } } } },
          vehicle: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'DRIVER_ASSIGNED',
          details: JSON.stringify({ tripId: id, driverId, vehicleId: driver.vehicleId }),
          ipAddress: getIp(req),
        },
      });

      return t;
    });

    let parentUserId: string | null = null;
    if (trip.subscriptionId) {
      const sub = await prisma.userSubscription.findUnique({
        where: { id: trip.subscriptionId },
        select: { userId: true },
      });
      parentUserId = sub?.userId ?? null;
    }
    await notifyDriverAssigned({
      tripId: id,
      parentUserId,
      driverProfileId: driver.profile?.id ?? null,
      driverFullName: driver.profile?.fullName ?? 'Driver',
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
