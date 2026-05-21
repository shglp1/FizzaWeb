import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10) || 20;
    const limit = Math.min(50, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          amountSar: true,
          status: true,
          purpose: true,
          gateway: true,
          invoiceId: true,
          subscriptionId: true,
          createdAt: true,
        },
      }),
      prisma.payment.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: {
        payments,
        meta: { page, limit, total, totalPages },
      },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/payments]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
