import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { isCancellable } from '@/lib/trips/tripLifecycle';
import { notifyCancelled, recordStatusChange } from '@/lib/trips/tripNotifications';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

const cancelReasonSchema = z.string().max(500).optional();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    let reason: string | undefined;
    try {
      const body = await req.json();
      const parsedReason = cancelReasonSchema.safeParse(
        typeof body?.reason === 'string' ? body.reason : undefined,
      );
      if (!parsedReason.success) {
        return NextResponse.json(
          { data: null, error: { message: 'Reason must be 500 characters or fewer' } },
          { status: 400 },
        );
      }
      reason = parsedReason.data;
    } catch { /* no body required */ }

    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        driver: { select: { profileId: true } },
        subscription: { select: { userId: true } },
        rider: { select: { parentId: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    // Access control: parent can cancel their own trips; admin can cancel any
    if (auth.role !== 'ADMIN') {
      const parentId = trip.subscription?.userId ?? trip.rider?.parentId;
      if (parentId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    }

    if (!isCancellable(trip.status as TripStatus)) {
      return NextResponse.json({
        data: null,
        error: { message: `Cannot cancel a trip with status: ${trip.status}` },
      }, { status: 422 });
    }

    await prisma.trip.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        statusReason: reason ?? 'Cancelled by parent',
        cancelledBy: auth.userId,
        chatClosedAt: new Date(),
      },
    });

    const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
    const driverProfileId = trip.driver?.profileId ?? null;

    await recordStatusChange(id, auth.userId, auth.role, trip.status, 'CANCELLED');
    await notifyCancelled({
      tripId: id,
      parentUserId,
      driverProfileId,
      reason,
      cancelledByRole: auth.role,
    });

    return NextResponse.json({ data: { id, status: 'CANCELLED' }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
