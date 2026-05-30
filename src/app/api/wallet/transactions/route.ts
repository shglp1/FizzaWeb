import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFamilyParent } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireFamilyParent();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10) || 20;
    const limit = Math.min(50, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!wallet) {
      return NextResponse.json(
        { data: null, error: { message: 'Wallet not found' } },
        { status: 404 },
      );
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          amountSar: true,
          txType: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: {
        transactions,
        meta: { page, limit, total, totalPages },
      },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/wallet/transactions]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
