/**
 * POST /api/trips/[id]/late
 * Record driver-late or rider-late events and notify stakeholders.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { z } from 'zod';
import { notifyDriverLate, notifyRiderLate } from '@/lib/trips/tripNotifications';

const lateSchema = z.object({
  type: z.enum(['DRIVER', 'RIDER']),
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 });
    }

    const parsed = lateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, { status: 400 });
    }

    const { type, reason } = parsed.data;

    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true, status: true, scheduledPickupTime: true,
        driver: { select: { id: true, profileId: true } },
        subscription: { select: { userId: true } },
        rider: { select: { parentId: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
    const driverProfileId = trip.driver?.profileId ?? null;
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    const notifInput = {
      tripId: id,
      parentUserId,
      driverProfileId,
      adminUserId: admin?.id ?? null,
      reason,
    };

    if (type === 'RIDER') {
      if (auth.role !== 'DRIVER' && auth.role !== 'ADMIN') {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
      if (auth.role === 'DRIVER' && trip.driver?.profileId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Not your trip' } }, { status: 403 });
      }
      if (trip.status !== 'ARRIVED_PICKUP') {
        return NextResponse.json({
          data: null,
          error: { message: 'Rider late can only be reported after arriving at pickup' },
        }, { status: 422 });
      }
      await notifyRiderLate(notifInput);
    } else {
      if (auth.role !== 'ADMIN' && auth.role !== 'DRIVER') {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
      if (auth.role === 'DRIVER' && trip.driver?.profileId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Not your trip' } }, { status: 403 });
      }
      const allowedStatuses = ['ON_THE_WAY', 'ARRIVED_PICKUP', 'PRE_TRIP'];
      if (!allowedStatuses.includes(trip.status)) {
        return NextResponse.json({
          data: null,
          error: { message: 'Driver late can only be reported while en route to pickup' },
        }, { status: 422 });
      }
      await notifyDriverLate(notifInput);
      if (reason?.trim()) {
        await prisma.trip.update({
          where: { id },
          data: { statusReason: reason.trim() },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: type === 'DRIVER' ? 'DRIVER_LATE_REPORTED' : 'RIDER_LATE_REPORTED',
        details: JSON.stringify({ tripId: id, reason }),
      },
    });

    return NextResponse.json({ data: { ok: true, type }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
