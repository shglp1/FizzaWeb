/**
 * GET /api/admin/trips/needs-dispatch
 * Queue of trips waiting for admin driver assignment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePaginationParams(searchParams);
    const urgentOnly = searchParams.get('urgent') === 'true';

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const where = {
      needsDispatch: true,
      status: 'SCHEDULED' as const,
      ...(urgentOnly
        ? {
            scheduledPickupTime: { lte: tomorrow },
            scheduledDate: { gte: new Date(now.toISOString().slice(0, 10)) },
          }
        : {}),
    };

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          scheduledPickupTime: true,
          pickupLocation: true,
          dropoffLocation: true,
          dispatchNote: true,
          legType: true,
          rider: { select: { id: true, name: true } },
          subscription: {
            select: {
              id: true,
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
      data: { trips, meta: buildPaginationMeta(page, limit, total) },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
