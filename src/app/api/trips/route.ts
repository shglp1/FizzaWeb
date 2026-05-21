import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import type { TripStatus } from '@prisma/client';

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

function buildStatusWhere(filter: string | null) {
  switch (filter) {
    case 'upcoming':
      return { status: { in: ['SCHEDULED', 'DRIVER_ASSIGNED'] as TripStatus[] } };
    case 'active':
      return { status: { in: ['ON_THE_WAY', 'PICKED_UP'] as TripStatus[] } };
    case 'completed':
      return { status: 'COMPLETED' as const };
    case 'cancelled':
      return { status: 'CANCELLED' as const };
    default:
      if (
        filter &&
        ['SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED'].includes(
          filter,
        )
      ) {
        return { status: filter as 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'ON_THE_WAY' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED' };
      }
      return {};
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const statusWhere = buildStatusWhere(statusFilter);

    let trips;

    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (!driver) {
        return NextResponse.json({ data: [], error: null });
      }
      trips = await prisma.trip.findMany({
        where: { driverId: driver.id, ...statusWhere },
        select: TRIP_SELECT,
        orderBy: { scheduledDate: 'desc' },
      });
    } else {
      // Parent — scoped to their subscriptions and riders
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

      const subscriptionIds = subscriptions.map((s) => s.id);
      const riderIds = riders.map((r) => r.id);

      trips = await prisma.trip.findMany({
        where: {
          OR: [
            { subscriptionId: { in: subscriptionIds } },
            { riderId: { in: riderIds } },
          ],
          ...statusWhere,
        },
        select: TRIP_SELECT,
        orderBy: { scheduledDate: 'desc' },
      });
    }

    return NextResponse.json({ data: trips, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
