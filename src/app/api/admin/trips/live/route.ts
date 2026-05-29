/**
 * GET /api/admin/trips/live
 * Live operations monitor: active trips with GPS freshness and pickup context.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { classifyTripForRole } from '@/lib/trips/tripClassification';
import { getBusinessDateKey } from '@/lib/time/businessTimezone';

const ACTIVE_STATUSES = [
  'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP',
  'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
] as const;

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const todayKey = getBusinessDateKey(new Date());
    const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [trips, financialReviewPending, staleNonTerminal] = await Promise.all([
      prisma.trip.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          scheduledDate: { gte: todayStart, lt: todayEnd },
        },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          scheduledPickupTime: true,
          pickupLocation: true,
          dropoffLocation: true,
          pickupLat: true,
          pickupLng: true,
          dropoffLat: true,
          dropoffLng: true,
          legType: true,
          rider: { select: { name: true } },
          driver: {
            select: {
              id: true,
              profile: { select: { fullName: true, phone: true } },
              vehicle: { select: { model: true, plateNumber: true, color: true } },
            },
          },
          vehicle: { select: { model: true, plateNumber: true, color: true } },
        },
        orderBy: [{ scheduledPickupTime: 'asc' }],
      }),
      prisma.trip.count({ where: { financialReviewStatus: 'PENDING' } }),
      prisma.trip.count({
        where: {
          scheduledDate: { lt: todayStart },
          status: { in: [...ACTIVE_STATUSES, 'DRIVER_ASSIGNED', 'SCHEDULED'] },
        },
      }),
    ]);

    const tripIds = trips.map((t) => t.id);
    const allLocations = tripIds.length
      ? await prisma.driverLocation.findMany({
          where: { tripId: { in: tripIds } },
          orderBy: { recordedAt: 'desc' },
          select: { tripId: true, lat: true, lng: true, recordedAt: true },
        })
      : [];
    const latestByTrip = new Map<string, (typeof allLocations)[0]>();
    for (const loc of allLocations) {
      if (loc.tripId && !latestByTrip.has(loc.tripId)) latestByTrip.set(loc.tripId, loc);
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const enriched = trips.map((trip) => {
      const scheduledDate = trip.scheduledDate.toISOString().slice(0, 10);
      const scheduledPickupTime = trip.scheduledPickupTime?.toISOString() ?? null;
      const classification = classifyTripForRole(
        { status: trip.status, scheduledDate, scheduledPickupTime, driverId: trip.driver?.id },
        { role: 'ADMIN' },
      );

      const loc = latestByTrip.get(trip.id) ?? null;
      const gpsAgeSec = loc
        ? Math.round((Date.now() - loc.recordedAt.getTime()) / 1000)
        : null;

      const etaMinutes = classification.minutesUntilPickup != null && classification.minutesUntilPickup > 0
        ? classification.minutesUntilPickup
        : null;

      return {
        ...trip,
        scheduledDate,
        scheduledPickupTime,
        vehicle: trip.vehicle ?? trip.driver?.vehicle ?? null,
        classification: {
          category: classification.category,
          displayLabel: classification.displayLabel,
          isStale: classification.isStale,
        },
        location: loc,
        gpsStale: !loc || loc.recordedAt < sixtySecondsAgo,
        gpsAgeSec,
        etaMinutes,
      };
    });

    const gpsStaleCount = enriched.filter((t) => t.gpsStale).length;
    const lateCount = enriched.filter((t) =>
      t.classification.category === 'missed_pickup'
      || (t.etaMinutes != null && t.etaMinutes < 0),
    ).length;

    return NextResponse.json({
      data: {
        todayKey,
        refreshedAt: new Date().toISOString(),
        summary: {
          active: enriched.length,
          gpsStale: gpsStaleCount,
          live: enriched.length - gpsStaleCount,
          financialReviewPending,
          staleNonTerminal,
          lateOrMissed: lateCount,
        },
        trips: enriched,
      },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
