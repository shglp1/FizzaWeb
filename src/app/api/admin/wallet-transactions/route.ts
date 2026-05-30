import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') ?? '';
    const txType = searchParams.get('txType') ?? '';
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const walletWhere: Record<string, unknown> = {};
    if (userId) walletWhere.userId = userId;

    const txWhere: Record<string, unknown> = {};
    if (txType) txWhere.txType = txType;
    if (dateFrom || dateTo) {
      txWhere.createdAt = {};
      if (dateFrom) (txWhere.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (txWhere.createdAt as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59Z');
    }
    if (userId) txWhere.wallet = { userId };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: txWhere,
        select: {
          id: true,
          amountSar: true,
          txType: true,
          source: true,
          reason: true,
          tripId: true,
          description: true,
          createdAt: true,
          adminUserId: true,
          adminUser: {
            select: {
              id: true,
              fullName: true,
              user: { select: { email: true } },
            },
          },
          wallet: {
            select: {
              id: true,
              balanceSar: true,
              user: { select: { id: true, fullName: true, user: { select: { email: true } } } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where: txWhere }),
    ]);

    return NextResponse.json({
      data: {
        transactions,
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
