import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { CANCELLABLE_BY_PARENT } from '@/lib/validations/trip';

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
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    // Verify ownership — parent can only cancel their own trips
    const [subscriptions, riders] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId: auth.userId },
        select: { id: true },
      }),
      prisma.rider.findMany({
        where: { parentId: auth.userId },
        select: { id: true },
      }),
    ]);

    const trip = await prisma.trip.findFirst({
      where: {
        id,
        OR: [
          { subscriptionId: { in: subscriptions.map((s) => s.id) } },
          { riderId: { in: riders.map((r) => r.id) } },
        ],
      },
    });

    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip not found or access denied' } },
        { status: 403 },
      );
    }

    if (!CANCELLABLE_BY_PARENT.includes(trip.status)) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `Cannot cancel a trip with status ${trip.status}. Only SCHEDULED or DRIVER_ASSIGNED trips can be cancelled.`,
          },
        },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.trip.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledBy: auth.userId },
      });

      await tx.notification.create({
        data: {
          userId: auth.userId,
          title: 'Trip Cancelled',
          message: `Your trip scheduled for ${new Date(trip.scheduledDate).toLocaleDateString()} has been cancelled.`,
          type: 'TRIP',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'TRIP_CANCELLED',
          details: JSON.stringify({ tripId: id, previousStatus: trip.status }),
          ipAddress: getIp(req),
        },
      });

      return t;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
