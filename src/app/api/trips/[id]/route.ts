import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

const TRIP_DETAIL_SELECT = {
  id: true,
  subscriptionId: true,
  status: true,
  statusReason: true,
  legType: true,
  scheduledDate: true,
  scheduledPickupTime: true,
  scheduledDropoffTime: true,
  actualPickupTime: true,
  actualDropoffTime: true,
  pickupLocation: true,
  dropoffLocation: true,
  pickupLat: true,
  pickupLng: true,
  dropoffLat: true,
  dropoffLng: true,
  chatOpenedAt: true,
  chatClosedAt: true,
  cancelledBy: true,
  createdAt: true,
  updatedAt: true,
  rider: { select: { id: true, name: true, relationship: true, school: true } },
  driver: {
    select: {
      id: true,
      rating: true,
      profile: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
    },
  },
  vehicle: { select: { id: true, model: true, plateNumber: true, color: true, capacity: true } },
  subscription: {
    select: { id: true, subscriptionType: true, package: { select: { name: true } } },
  },
  events: {
    select: { id: true, eventType: true, message: true, actorRole: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

/** Verify the caller can access this trip. Returns the trip or throws. */
async function fetchTripWithAuth(id: string, auth: { userId: string; role: string }) {
  const trip = await prisma.trip.findUnique({ where: { id }, select: TRIP_DETAIL_SELECT });
  if (!trip) return null;

  if (auth.role === 'ADMIN') return trip;

  if (auth.role === 'DRIVER') {
    if (trip.driver?.profile?.id !== auth.userId) return null;
    return trip;
  }

  // Parent: must own the subscription or rider
  const [sub, rider] = await Promise.all([
    trip.subscriptionId
      ? prisma.userSubscription.findFirst({
          where: { id: trip.subscriptionId, userId: auth.userId },
          select: { id: true },
        })
      : null,
    trip.rider
      ? prisma.rider.findFirst({
          where: { id: trip.rider.id, parentId: auth.userId },
          select: { id: true },
        })
      : null,
  ]);
  if (!sub && !rider) return null;
  return trip;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const trip = await fetchTripWithAuth(id, auth);
    if (!trip) return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    return NextResponse.json({ data: trip, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}