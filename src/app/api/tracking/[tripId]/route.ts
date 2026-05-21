import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  _req: Request,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { tripId } = await context.params;

    // Fetch the trip with full details
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        rider: { select: { id: true, name: true, relationship: true, phone: true } },
        driver: {
          include: {
            profile: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
            vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
          },
        },
        vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
        subscription: { select: { id: true, subscriptionType: true, userId: true } },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip not found' } },
        { status: 404 },
      );
    }

    // Authorization check
    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (!driver || trip.driverId !== driver.id) {
        return NextResponse.json(
          { data: null, error: { message: 'Access denied' } },
          { status: 403 },
        );
      }
    } else if (auth.role !== 'ADMIN') {
      // Parent check — trip must belong to their subscription or rider
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
      const subIds = new Set(subscriptions.map((s) => s.id));
      const riderIds = new Set(riders.map((r) => r.id));
      const hasAccess =
        (trip.subscriptionId && subIds.has(trip.subscriptionId)) ||
        (trip.riderId && riderIds.has(trip.riderId));
      if (!hasAccess) {
        return NextResponse.json(
          { data: null, error: { message: 'Access denied' } },
          { status: 403 },
        );
      }
    }

    // Get latest driver location for this trip
    const currentLocation = trip.driverId
      ? await prisma.driverLocation.findFirst({
          where: { driverId: trip.driverId, tripId },
          orderBy: { recordedAt: 'desc' },
          select: { lat: true, lng: true, recordedAt: true },
        })
      : null;

    return NextResponse.json({
      data: { trip, currentLocation },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
