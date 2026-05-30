/**
 * GET /api/admin/trips/operations
 * Returns today's operational overview: counts by status, unassigned, delayed, GPS-stale, chat-flagged.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { getBusinessDateKey } from '@/lib/time/businessTimezone';

const STALE_STATUSES = [
  'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
  'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
] as const;

export async function GET(_req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const todayKey = getBusinessDateKey(new Date());
    const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [
      totalToday, activeTrips, unassignedTrips, needsDispatchTrips, completedToday,
      cancelledToday, flaggedMessages, driverCount, staleNonTerminal, financialReviewPending,
    ] = await Promise.all([
      prisma.trip.count({ where: { scheduledDate: { gte: todayStart, lt: todayEnd } } }),
      prisma.trip.count({
        where: {
          scheduledDate: { gte: todayStart, lt: todayEnd },
          status: { in: ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'] },
        },
      }),
      prisma.trip.count({
        where: {
          scheduledDate: { gte: todayStart, lt: todayEnd },
          status: 'SCHEDULED',
          driverId: null,
        },
      }),
      prisma.trip.count({
        where: {
          scheduledDate: { gte: todayStart, lt: todayEnd },
          needsDispatch: true,
          status: 'SCHEDULED',
        },
      }),
      prisma.trip.count({ where: { scheduledDate: { gte: todayStart, lt: todayEnd }, status: 'COMPLETED' } }),
      prisma.trip.count({ where: { scheduledDate: { gte: todayStart, lt: todayEnd }, status: 'CANCELLED' } }),
      prisma.tripChatMessage.count({ where: { moderationStatus: { in: ['FLAGGED', 'BLOCKED'] } } }),
      prisma.driver.count({ where: { isSuspended: false } }),
      prisma.trip.count({
        where: {
          scheduledDate: { lt: todayStart },
          status: { in: [...STALE_STATUSES] },
        },
      }),
      prisma.trip.count({ where: { financialReviewStatus: 'PENDING' } }),
    ]);

    // Detect GPS stale: active trips where latest location is > 60s old or missing
    const activeTripList = await prisma.trip.findMany({
      where: {
        scheduledDate: { gte: todayStart, lt: todayEnd },
        status: { in: ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'] },
      },
      select: { id: true, driverId: true },
    });

    let gpsStaleCount = 0;
    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    for (const trip of activeTripList) {
      if (!trip.driverId) { gpsStaleCount++; continue; }
      const loc = await prisma.driverLocation.findFirst({
        where: { tripId: trip.id },
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      });
      if (!loc || loc.recordedAt < sixtySecondsAgo) gpsStaleCount++;
    }

    // No-show trips today
    const noShowCount = await prisma.trip.count({
      where: { scheduledDate: { gte: todayStart, lt: todayEnd }, status: 'NO_SHOW' },
    });

    // Driver workload snapshot (top 10 drivers)
    const driversToday = await prisma.driver.findMany({
      where: { isSuspended: false },
      select: {
        id: true,
        profile: { select: { fullName: true, phone: true } },
        trips: {
          where: { scheduledDate: { gte: todayStart, lt: todayEnd } },
          select: { id: true, status: true, scheduledPickupTime: true, rider: { select: { name: true } } },
          orderBy: { scheduledPickupTime: 'asc' },
        },
      },
      take: 20,
    });

    const driverWorkload = driversToday
      .filter((d) => d.trips.length > 0)
      .map((d) => ({
        driverId: d.id,
        fullName: d.profile?.fullName ?? 'Unknown',
        phone: d.profile?.phone ?? null,
        tripsToday: d.trips.length,
        activeTrip: d.trips.find((t) => ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(t.status)) ?? null,
        nextTrip: d.trips.find((t) => ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(t.status)) ?? null,
        completedToday: d.trips.filter((t) => t.status === 'COMPLETED').length,
      }));

    return NextResponse.json({
      data: {
        today: {
          total: totalToday,
          active: activeTrips,
          unassigned: unassignedTrips,
          needsDispatch: needsDispatchTrips,
          completed: completedToday,
          cancelled: cancelledToday,
          noShow: noShowCount,
          gpsStale: gpsStaleCount,
          chatFlagged: flaggedMessages,
          staleNonTerminal,
          financialReviewPending,
        },
        driverCount,
        driverWorkload,
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
