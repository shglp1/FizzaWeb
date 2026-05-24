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
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (status && ['SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.scheduledDate = { gte: d, lt: next };
    }
    if (driverId) where.driverId = driverId;
    if (searchParams.get('needsDispatch') === 'true') where.needsDispatch = true;

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        select: {
          id: true,
          status: true,
          needsDispatch: true,
          dispatchNote: true,
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
          subscription: { select: { id: true, subscriptionType: true } },
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
