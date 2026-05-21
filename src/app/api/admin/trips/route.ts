import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const driverId = searchParams.get('driverId');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = 20;

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

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          rider: { select: { id: true, name: true, relationship: true, school: true } },
          driver: {
            include: {
              profile: { select: { fullName: true, phone: true } },
              vehicle: { select: { model: true, plateNumber: true, color: true } },
            },
          },
          vehicle: { select: { model: true, plateNumber: true, color: true } },
          subscription: { select: { id: true, subscriptionType: true } },
        },
        orderBy: { scheduledDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trip.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        trips,
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
