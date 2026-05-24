import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    const purpose = searchParams.get('purpose') ?? '';
    const userId = searchParams.get('userId') ?? '';
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (purpose) where.purpose = purpose;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59Z');
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          amountSar: true,
          status: true,
          purpose: true,
          gateway: true,
          invoiceId: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, fullName: true, user: { select: { email: true } } } },
          subscription: { select: { id: true, subscriptionType: true, status: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        payments,
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
