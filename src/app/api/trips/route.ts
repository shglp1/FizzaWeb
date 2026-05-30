import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import type { TripStatus } from '@prisma/client';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import { filterTripsForRoleApi, riyadhTodayDateFloor, needsClassificationFilter, CLASSIFICATION_FETCH_CAP } from '@/lib/trips/tripApiFilters';
import {
  buildParentTripScope,
  isHistoricalTripListFilter,
  operationalSubscriptionTripFilter,
} from '@/lib/subscriptions/subscriptionTripLifecycle';

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
    case 'review':
      return {
        status: {
          in: ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'] as TripStatus[],
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
      const driverStatusWhere = statusFilter === 'upcoming'
        ? { status: { in: ['DRIVER_ASSIGNED', 'PRE_TRIP'] as TripStatus[] } }
        : statusWhere;
      where = { driverId: driver.id, ...baseWhere, ...driverStatusWhere };
      if (!isHistoricalTripListFilter(statusFilter)) {
        where = { AND: [where, operationalSubscriptionTripFilter()] };
      }
      if (['upcoming', 'active', 'review'].includes(statusFilter ?? '') && !dateRange) {
        where = { ...where, ...(statusFilter === 'review' ? {} : { scheduledDate: { gte: riyadhTodayDateFloor() } }) };
      }
    } else {
      const [activeSubscriptions, allSubscriptions, riders] = await Promise.all([
        prisma.userSubscription.findMany({
          where: { userId: auth.userId, status: 'ACTIVE' },
          select: { id: true },
        }),
        prisma.userSubscription.findMany({
          where: { userId: auth.userId },
          select: { id: true },
        }),
        prisma.rider.findMany({ where: { parentId: auth.userId }, select: { id: true } }),
      ]);
      const parentScope = buildParentTripScope({
        activeSubscriptionIds: activeSubscriptions.map((s) => s.id),
        allSubscriptionIds: allSubscriptions.map((s) => s.id),
        riderIds: riders.map((r) => r.id),
        statusFilter,
      });
      where = { AND: [parentScope, baseWhere] };
      if (['upcoming', 'active'].includes(statusFilter ?? '') && !dateRange) {
        where = { AND: [where, { scheduledDate: { gte: riyadhTodayDateFloor() } }] };
      }
    }

    const useClassification = needsClassificationFilter(auth.role, statusFilter);

    let total: number;
    let trips: Awaited<ReturnType<typeof prisma.trip.findMany<{ select: typeof TRIP_SELECT }>>>;
    let classificationTruncated = false;

    if (useClassification) {
      const allTrips = await prisma.trip.findMany({
        where,
        select: TRIP_SELECT,
        orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
        take: CLASSIFICATION_FETCH_CAP + 1,
      });
      classificationTruncated = allTrips.length > CLASSIFICATION_FETCH_CAP;
      const capped = classificationTruncated ? allTrips.slice(0, CLASSIFICATION_FETCH_CAP) : allTrips;
      const enrichedAll = capped.map((t) => ({
        ...t,
        displayLabel: getDisplayLabel(t.status as TripStatus),
      }));
      const filteredAll = filterTripsForRoleApi(enrichedAll, {
        role: auth.role === 'DRIVER' ? 'DRIVER' : 'PARENT',
        statusFilter,
      });
      total = filteredAll.length;
      trips = filteredAll.slice((page - 1) * limit, page * limit);
    } else {
      [total, trips] = await Promise.all([
        prisma.trip.count({ where }),
        prisma.trip.findMany({
          where,
          select: TRIP_SELECT,
          orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
    }

    const enriched = trips.map((t) => ({
      ...t,
      displayLabel: getDisplayLabel(t.status as TripStatus),
    }));

    return NextResponse.json({
      data: enriched,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        ...(classificationTruncated ? { classificationTruncated: true, classificationCap: CLASSIFICATION_FETCH_CAP } : {}),
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
