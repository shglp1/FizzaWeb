import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = 20;
    const skip = (page - 1) * limit;

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
      data: { applications, total, page, limit },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
