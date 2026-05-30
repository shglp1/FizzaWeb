/**
 * GET /api/admin/trips/live
 * Live operations monitor: active trips with GPS freshness and pickup context.
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

    // Fetch only the single latest GPS row per active trip in one query, instead of
    // loading the entire GPS history for every trip and discarding all but the head.
    // ROW_NUMBER() requires MySQL 8.0+ (already assumed by existing migrations).
    // Backed by the driver_locations (trip_id, recorded_at) composite index.
    type LatestLocationRow = { trip_id: string; lat: number; lng: number; recorded_at: Date };
    const latestLocations: LatestLocationRow[] = tripIds.length
      ? await prisma.$queryRaw<LatestLocationRow[]>`
          SELECT trip_id, lat, lng, recorded_at
          FROM (
            SELECT trip_id, lat, lng, recorded_at,
                   ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY recorded_at DESC) AS rn
            FROM driver_locations
            WHERE trip_id IN (${Prisma.join(tripIds)})
          ) ranked
          WHERE rn = 1
        `
      : [];

    type LatestLocation = { tripId: string; lat: number; lng: number; recordedAt: Date };
    const latestByTrip = new Map<string, LatestLocation>();
    for (const row of latestLocations) {
      latestByTrip.set(row.trip_id, {
        tripId: row.trip_id,
        lat: row.lat,
        lng: row.lng,
        recordedAt: new Date(row.recorded_at),
      });
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
