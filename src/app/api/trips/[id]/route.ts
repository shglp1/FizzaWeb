import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

const TRIP_SELECT = {
  id: true,
  status: true,
  scheduledDate: true,
  scheduledPickupTime: true,
  scheduledDropoffTime: true,
  actualPickupTime: true,
  actualDropoffTime: true,
  pickupLocation: true,
  dropoffLocation: true,
  cancelledBy: true,
  createdAt: true,
  rider: { select: { id: true, name: true, relationship: true, school: true } },
  driver: {
    select: {
      id: true,
      rating: true,
      profile: { select: { fullName: true, phone: true, avatarUrl: true } },
    },
  },
  vehicle: { select: { id: true, model: true, plateNumber: true, color: true, capacity: true } },
  subscription: {
    select: { id: true, subscriptionType: true, package: { select: { name: true } } },
  },
} as const;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    let trip;

    if (auth.role === 'ADMIN') {
      trip = await prisma.trip.findUnique({ where: { id }, select: TRIP_SELECT });
    } else if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      trip = driver
        ? await prisma.trip.findFirst({ where: { id, driverId: driver.id }, select: TRIP_SELECT })
        : null;
    } else {
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
      trip = await prisma.trip.findFirst({
        where: {
          id,
          OR: [
            { subscriptionId: { in: subscriptions.map((s) => s.id) } },
            { riderId: { in: riders.map((r) => r.id) } },
          ],
        },
        select: TRIP_SELECT,
      });
    }

    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip not found or access denied' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: trip, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
