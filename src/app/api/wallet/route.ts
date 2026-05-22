import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;

    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        balanceSar: 0,
      },
      update: {},
      select: {
        id: true,
        balanceSar: true,
        createdAt: true,
        updatedAt: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amountSar: true,
            txType: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    const loyalty = await prisma.loyaltyAccount.findUnique({
      where: { userId },
      select: { pointsBalance: true },
    });

    return NextResponse.json({ data: { wallet, loyaltyPoints: loyalty?.pointsBalance ?? 0 }, error: null });
  } catch (error) {
    console.error('[GET /api/wallet]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
