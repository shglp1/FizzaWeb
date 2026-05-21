import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { tripStatusUpdateSchema, isValidStatusTransition } from '@/lib/validations/trip';

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

    if (auth.role !== 'DRIVER' && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { data: null, error: { message: 'Forbidden' } },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    const body = await req.json();
    const parsed = tripStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { status: newStatus } = parsed.data;

    // Verify access
    let trip;
    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (!driver) {
        return NextResponse.json(
          { data: null, error: { message: 'Driver profile not found' } },
          { status: 403 },
        );
      }
      trip = await prisma.trip.findFirst({ where: { id, driverId: driver.id } });
    } else {
      trip = await prisma.trip.findUnique({ where: { id } });
    }

    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip not found or access denied' } },
        { status: 403 },
      );
    }

    if (!isValidStatusTransition(trip.status, newStatus, auth.role)) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `Invalid status transition: ${trip.status} → ${newStatus}`,
          },
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const timeUpdate =
      newStatus === 'PICKED_UP' ? { actualPickupTime: now } :
      newStatus === 'COMPLETED' ? { actualDropoffTime: now } : {};

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.trip.update({
        where: { id },
        data: { status: newStatus, ...timeUpdate },
      });

      // Notify the parent/user associated with this trip's subscription
      if (t.subscriptionId) {
        const sub = await tx.userSubscription.findUnique({
          where: { id: t.subscriptionId },
          select: { userId: true },
        });
        if (sub) {
          const label =
            newStatus === 'ON_THE_WAY' ? 'Driver is on the way' :
            newStatus === 'PICKED_UP' ? 'Rider has been picked up' :
            newStatus === 'COMPLETED' ? 'Trip completed' :
            `Trip status: ${newStatus}`;

          await tx.notification.create({
            data: {
              userId: sub.userId,
              title: label,
              message: `Your trip on ${new Date(t.scheduledDate).toLocaleDateString()} is now: ${label.toLowerCase()}.`,
              type: 'TRIP',
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'TRIP_STATUS_CHANGED',
          details: JSON.stringify({ tripId: id, from: trip.status, to: newStatus }),
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
