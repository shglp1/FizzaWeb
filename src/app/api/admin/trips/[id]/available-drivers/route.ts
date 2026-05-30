/**
 * GET /api/admin/trips/[id]/available-drivers
 * Drivers with feasibility preview for manual assignment (uses existing dispatch logic).
 * Response includes city, serviceArea, availability, lastGpsAt, and a cityMatch hint
 * so admin can make informed geographic assignment decisions.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { getDispatchConfig } from '@/lib/dispatch/config';
import { decideTripDispatch } from '@/lib/dispatch/generateTrips';
import type { TimelineTrip } from '@/lib/dispatch/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        scheduledDate: true,
        scheduledPickupTime: true,
        scheduledDropoffTime: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        subscription: { select: { oneWayDistanceKm: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    const config = await getDispatchConfig();
    const dayStart = new Date(trip.scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const candidate: TimelineTrip = {
      id: trip.id,
      scheduledPickupTime: trip.scheduledPickupTime,
      scheduledDropoffTime: trip.scheduledDropoffTime,
      pickupLat: trip.pickupLat,
      pickupLng: trip.pickupLng,
      dropoffLat: trip.dropoffLat,
      dropoffLng: trip.dropoffLng,
    };

    const drivers = await prisma.driver.findMany({
      where: { isSuspended: false },
      select: {
        id: true,
        availability: true,
        rating: true,
        city: true,
        serviceArea: true,
        profile: { select: { fullName: true, phone: true } },
        vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
        trips: {
          where: { scheduledDate: { gte: dayStart, lt: dayEnd }, status: { notIn: ['CANCELLED'] } },
          select: { id: true },
        },
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { recordedAt: true },
        },
      },
      orderBy: [{ availability: 'desc' }, { rating: 'desc' }],
    });

    const driverDayCache = new Map<string, TimelineTrip[]>();
    const list = await Promise.all(
      drivers.map(async (d) => {
        const decision = await decideTripDispatch({
          candidate,
          driverId: d.id,
          scheduledDate: trip.scheduledDate,
          driverDayCache,
          config,
        });

        const lastGpsAt = d.locations[0]?.recordedAt ?? null;
        const lastGpsAgeSeconds = lastGpsAt
          ? Math.round((Date.now() - new Date(lastGpsAt).getTime()) / 1000)
          : null;

        // cityMatch is null until subscription city can be derived (future: reverse-geocode pickup coords).
        // Admin can compare driver.city visually against the subscription pickup area.
        const cityMatch: boolean | null = null;

        return {
          id: d.id,
          fullName: d.profile?.fullName ?? 'Driver',
          phone: d.profile?.phone ?? null,
          availability: d.availability,
          rating: d.rating ? Number(d.rating) : null,
          city: d.city ?? null,
          serviceArea: d.serviceArea ?? null,
          cityMatch,
          vehicle: d.vehicle,
          tripsToday: d.trips.length,
          lastGpsAt,
          lastGpsAgeSeconds,
          feasible: decision.assignDriver,
          conflictReason: d.availability === false
            ? 'Driver is marked unavailable'
            : (decision.dispatchNote ?? null),
        };
      }),
    );

    return NextResponse.json({ data: { drivers: list }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
