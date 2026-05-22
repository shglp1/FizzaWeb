import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId') ?? '';
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (parentId) where.parentId = parentId;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { school: { contains: search } },
      ];
    }

    const [riders, total] = await Promise.all([
      prisma.rider.findMany({
        where,
        select: {
          id: true,
          name: true,
          relationship: true,
          school: true,
          grade: true,
          phone: true,
          specialNeeds: true,
          isActive: true,
          createdAt: true,
          parent: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
          _count: { select: { subscriptions: true, trips: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rider.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        riders,
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
