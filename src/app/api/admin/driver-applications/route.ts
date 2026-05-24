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
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const where = status
      ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES' }
      : {};

    const [applications, total] = await Promise.all([
      prisma.driverApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          applicant: {
            select: { fullName: true, phone: true, user: { select: { email: true } } },
          },
          reviewer: { select: { fullName: true } },
        },
      }),
      prisma.driverApplication.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        applications,
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
