/**
 * GET /api/tracking/[tripId]
 * Returns tracking data for a specific trip: trip details + latest driver location + events.
 * Access: parent owns trip, driver is assigned driver, or admin.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { tripId } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true, status: true, statusReason: true, legType: true,
        scheduledDate: true, scheduledPickupTime: true, scheduledDropoffTime: true,
        actualPickupTime: true, actualDropoffTime: true,
        pickupLocation: true, dropoffLocation: true,
        pickupLat: true, pickupLng: true,
        dropoffLat: true, dropoffLng: true,
        chatOpenedAt: true, chatClosedAt: true,
        rider: { select: { id: true, name: true, relationship: true } },
        driver: {
          select: {
            id: true, rating: true,
            profile: { select: { fullName: true, phone: true, avatarUrl: true } },
          },
        },
        vehicle: { select: { model: true, plateNumber: true, color: true } },
        subscription: { select: { userId: true } },
        events: {
          select: { id: true, eventType: true, message: true, actorRole: true, createdAt: true },
          orderBy: { createdAt: 'asc' as const },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    // Access control
    if (auth.role !== 'ADMIN') {
      if (auth.role === 'DRIVER') {
        if (trip.driver?.profile == null) {
          // driver not assigned or can't verify — look up by driver.profileId
          const driver = await prisma.driver.findFirst({
            where: { profileId: auth.userId },
            select: { id: true },
          });
          const thisTrip = await prisma.trip.findFirst({
            where: { id: tripId, driverId: driver?.id ?? '' },
            select: { id: true },
          });
          if (!thisTrip) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
        }
      } else {
        // Parent access
        const parentId = trip.subscription?.userId ?? null;
        if (parentId !== auth.userId) {
          // Also check rider parent
          const riderId = (trip as { riderId?: string | null }).riderId ?? null;
          if (riderId) {
            const rider = await prisma.rider.findFirst({
              where: { id: riderId, parentId: auth.userId },
              select: { id: true },
            });
            if (!rider) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
          } else {
            return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
          }
        }
      }
    }

    // Fetch latest driver location (most recent for this trip or by driver)
    const latestLocation = trip.driver
      ? await prisma.driverLocation.findFirst({
          where: { tripId },
          orderBy: { recordedAt: 'desc' },
          select: { lat: true, lng: true, recordedAt: true },
        }) ?? await prisma.driverLocation.findFirst({
          where: { driver: { profile: { id: trip.driver.profile?.fullName ? undefined : undefined } } },
          orderBy: { recordedAt: 'desc' },
          select: { lat: true, lng: true, recordedAt: true },
        })
      : null;

    // Determine if GPS is stale (> 60 seconds old)
    const gpsStale = latestLocation
      ? (Date.now() - new Date(latestLocation.recordedAt).getTime()) > 60_000
      : null;

    return NextResponse.json({
      data: {
        trip,
        location: latestLocation
          ? { lat: latestLocation.lat, lng: latestLocation.lng, recordedAt: latestLocation.recordedAt, stale: gpsStale ?? false }
          : null,
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
