import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const isSuspended = searchParams.get('isSuspended');
    const available = searchParams.get('available');
    const search = searchParams.get('search') ?? '';
    const assignable = searchParams.get('assignable'); // drivers available for trip assignment
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // assignable mode: not suspended, has vehicle — used by trip assignment UI
    if (assignable === 'true') {
      const drivers = await prisma.driver.findMany({
        where: { isSuspended: false, vehicleId: { not: null } },
        include: {
          profile: { select: { id: true, fullName: true, phone: true } },
          vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({ data: drivers, error: null });
    }

    const where: Record<string, unknown> = {};
    if (isSuspended === 'true') where.isSuspended = true;
    if (isSuspended === 'false') where.isSuspended = false;
    if (available === 'true') where.availability = true;
    if (search) {
      where.profile = { fullName: { contains: search } };
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        select: {
          id: true,
          availability: true,
          isSuspended: true,
          suspensionReason: true,
          rating: true,
          createdAt: true,
          profile: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
          vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
          _count: { select: { trips: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.driver.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        drivers,
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
