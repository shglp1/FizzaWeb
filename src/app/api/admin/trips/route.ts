import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const driverId = searchParams.get('driverId');
    const q = searchParams.get('q')?.trim();
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (searchParams.get('active') === 'true') {
      where.status = { in: ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'] };
    } else if (status && ['SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
      where.status = status;
    }
    if (searchParams.get('unassigned') === 'true') {
      where.driverId = null;
      where.status = 'SCHEDULED';
    }
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.scheduledDate = { gte: d, lt: next };
    }
    if (driverId) where.driverId = driverId;
    if (searchParams.get('needsDispatch') === 'true') where.needsDispatch = true;
    const finReview = searchParams.get('financialReviewStatus');
    if (finReview === 'PENDING') where.financialReviewStatus = 'PENDING';
    else if (finReview && ['PAY_DRIVER', 'NO_PAY_DRIVER', 'REFUND_PARENT', 'CREDIT_PARENT', 'KEEP_REVENUE', 'INCIDENT'].includes(finReview)) {
      where.financialReviewStatus = finReview;
    }
    if (searchParams.get('paymentActionRequired') === 'true') {
      where.OR = [
        { financialReviewStatus: 'REFUND_PARENT' },
        { financialReviewStatus: 'CREDIT_PARENT', walletCreditTransactionId: null },
      ];
    }
    if (q) {
      where.OR = [
        { pickupLocation: { contains: q } },
        { dropoffLocation: { contains: q } },
        { rider: { name: { contains: q } } },
        { subscription: { user: { fullName: { contains: q } } } },
      ];
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        select: {
          id: true,
          status: true,
          needsDispatch: true,
          dispatchNote: true,
          legType: true,
          scheduledDate: true,
          scheduledPickupTime: true,
          scheduledDropoffTime: true,
          actualPickupTime: true,
          actualDropoffTime: true,
          pickupLocation: true,
          dropoffLocation: true,
          financialReviewStatus: true,
          financialReviewReason: true,
          walletCreditTransactionId: true,
          billableKmOverride: true,
          pickupLat: true,
          pickupLng: true,
          dropoffLat: true,
          dropoffLng: true,
          rider: { select: { id: true, name: true, relationship: true, school: true } },
          driver: {
            select: {
              id: true,
              rating: true,
              profile: { select: { fullName: true, phone: true } },
              vehicle: { select: { model: true, plateNumber: true, color: true } },
            },
          },
          vehicle: { select: { model: true, plateNumber: true, color: true } },
          subscription: {
            select: {
              id: true,
              subscriptionType: true,
              assignedDriverId: true,
              user: { select: { fullName: true } },
            },
          },
        },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.trip.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        trips,
        meta: buildPaginationMeta(page, limit, total),
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
