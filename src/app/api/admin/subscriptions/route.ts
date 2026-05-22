import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    const paymentStatus = searchParams.get('paymentStatus') ?? '';
    const packageId = searchParams.get('packageId') ?? '';
    const userId = searchParams.get('userId') ?? '';
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (packageId) where.packageId = packageId;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59Z');
    }

    const today = new Date();

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where,
        select: {
          id: true,
          subscriptionType: true,
          status: true,
          paymentStatus: true,
          autoRenewal: true,
          startsOn: true,
          endsOn: true,
          finalPriceSar: true,
          packagePriceSar: true,
          addOnsPriceSar: true,
          distancePriceSar: true,
          extraRidersPriceSar: true,
          estimatedDistanceKm: true,
          cancellationReason: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
          rider: { select: { id: true, name: true, school: true } },
          package: { select: { id: true, name: true, billingCycle: true } },
          addOns: { select: { addOn: { select: { id: true, name: true } } } },
          subscriptionRiders: { select: { rider: { select: { id: true, name: true } }, isPrimary: true } },
          _count: { select: { trips: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userSubscription.count({ where }),
    ]);

    // Calculate rides used/remaining + days left from DB aggregation
    const subsWithUsage = await Promise.all(
      subscriptions.map(async (sub) => {
        const completedTrips = await prisma.trip.count({
          where: { subscriptionId: sub.id, status: 'COMPLETED' },
        });
        const daysLeft = sub.endsOn
          ? Math.max(0, Math.ceil((sub.endsOn.getTime() - today.getTime()) / 86_400_000))
          : null;
        return { ...sub, ridesUsed: completedTrips, daysLeft };
      }),
    );

    return NextResponse.json({
      data: {
        subscriptions: subsWithUsage,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
