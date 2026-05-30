/**
 * GET /api/tracking
 * Returns the list of trips a parent can currently track (DRIVER_ASSIGNED or active).
 * If exactly one trackable trip exists, the client can redirect automatically.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { riyadhTodayDateFloor } from '@/lib/trips/tripApiFilters';
import { filterTripsForRoleApi } from '@/lib/trips/tripApiFilters';
import { operationalSubscriptionTripFilter } from '@/lib/subscriptions/subscriptionTripLifecycle';

const TRACKABLE_STATUSES = [
  'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
  'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
] as const;

export async function GET(_req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const operationalSubFilter = operationalSubscriptionTripFilter();

    // Drivers see their own active/upcoming trips (ACTIVE subscription only)
    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (!driver) return NextResponse.json({ data: { trips: [] }, error: null });

      const trips = await prisma.trip.findMany({
        where: {
          AND: [
            { driverId: driver.id, status: { in: [...TRACKABLE_STATUSES] } },
            operationalSubFilter,
          ],
        },
        select: {
          id: true, status: true, scheduledDate: true,
          scheduledPickupTime: true, pickupLocation: true, dropoffLocation: true,
          legType: true,
          rider: { select: { name: true } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
      });
      return NextResponse.json({ data: { trips, total: trips.length }, error: null });
    }

    // Parents see trips linked to ACTIVE subscriptions or riders without sub link
    const [activeSubscriptions, riders] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId: auth.userId, status: 'ACTIVE' },
        select: { id: true },
      }),
      prisma.rider.findMany({ where: { parentId: auth.userId }, select: { id: true } }),
    ]);
    const activeSubIds = activeSubscriptions.map((s) => s.id);
    const riderIds = riders.map((r) => r.id);

    const scopeOr = [
      ...(activeSubIds.length ? [{ subscriptionId: { in: activeSubIds } }] : []),
      ...(riderIds.length ? [{ subscriptionId: null, riderId: { in: riderIds } }] : []),
    ];

    if (scopeOr.length === 0) {
      return NextResponse.json({ data: { trips: [], total: 0 }, error: null });
    }

    const todayFloor = riyadhTodayDateFloor();

    const trips = await prisma.trip.findMany({
      where: {
        AND: [
          { OR: scopeOr },
          { status: { in: [...TRACKABLE_STATUSES] } },
          { scheduledDate: { gte: todayFloor } },
          operationalSubFilter,
        ],
      },
      select: {
        id: true, status: true, scheduledDate: true,
        scheduledPickupTime: true, pickupLocation: true, dropoffLocation: true,
        legType: true,
        rider: { select: { name: true } },
        driver: { select: { profile: { select: { fullName: true } } } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
    });

    const filtered = filterTripsForRoleApi(trips, {
      role: 'PARENT',
      statusFilter: null,
      excludeStale: true,
    });

    return NextResponse.json({ data: { trips: filtered, total: filtered.length }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
