import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import type { TripStatus } from '@prisma/client';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';

const TRIP_SELECT = {
  id: true,
  status: true,
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
  statusReason: true,
  cancelledBy: true,
  createdAt: true,
  rider: { select: { id: true, name: true, relationship: true, school: true, grade: true, specialNeeds: true, pickupNotes: true, dropoffNotes: true, emergencyContactName: true, emergencyContactPhone: true } },
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

const ALL_STATUSES: TripStatus[] = [
  'SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
  'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF',
  'ARRIVED_DROPOFF', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
];

function buildStatusWhere(filter: string | null) {
  switch (filter) {
    case 'upcoming':
      return { status: { in: ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP'] as TripStatus[] } };
    case 'active':
      return {
        status: {
          in: ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'] as TripStatus[],
        },
      };
    case 'completed':
      return { status: 'COMPLETED' as const };
    case 'cancelled':
      return { status: { in: ['CANCELLED', 'NO_SHOW'] as TripStatus[] } };
    default:
      if (filter && (ALL_STATUSES as string[]).includes(filter)) {
        return { status: filter as TripStatus };
      }
      return {};
  }
}

function parseDateRange(from: string | null, to: string | null) {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from + 'T00:00:00.000Z');
  if (to) dateFilter.lte = new Date(to + 'T23:59:59.999Z');
  return Object.keys(dateFilter).length ? dateFilter : undefined;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const statusWhere = buildStatusWhere(statusFilter);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const dateRange = parseDateRange(from, to);

    const baseWhere: Record<string, unknown> = { ...statusWhere };
    if (dateRange) baseWhere.scheduledDate = dateRange;

    let where: Record<string, unknown>;

    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (!driver) {
        return NextResponse.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 }, error: null });
      }
      where = { driverId: driver.id, ...baseWhere };
    } else {
      const [subscriptions, riders] = await Promise.all([
        prisma.userSubscription.findMany({ where: { userId: auth.userId }, select: { id: true } }),
        prisma.rider.findMany({ where: { parentId: auth.userId }, select: { id: true } }),
      ]);
      where = {
        OR: [
          { subscriptionId: { in: subscriptions.map((s) => s.id) } },
          { riderId: { in: riders.map((r) => r.id) } },
        ],
        ...baseWhere,
      };
    }

    const [total, trips] = await Promise.all([
      prisma.trip.count({ where }),
      prisma.trip.findMany({
        where,
        select: TRIP_SELECT,
        orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const enriched = trips.map((t) => ({
      ...t,
      displayLabel: getDisplayLabel(t.status as TripStatus),
    }));

    return NextResponse.json({
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
