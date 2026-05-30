import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;

    const walletSelect = {
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
          source: true,
          reason: true,
          description: true,
          createdAt: true,
        },
      },
    } as const;

    // Fast path: read-only lookup (no write lock on every wallet view).
    // Only create the wallet on first access. Handle the rare concurrent
    // first-access race via the unique(userId) constraint: on P2002 re-read.
    let wallet = await prisma.wallet.findUnique({ where: { userId }, select: walletSelect });
    if (!wallet) {
      try {
        wallet = await prisma.wallet.create({
          data: { id: randomUUID(), userId, balanceSar: 0 },
          select: walletSelect,
        });
      } catch {
        wallet = await prisma.wallet.findUnique({ where: { userId }, select: walletSelect });
      }
    }

    const loyalty = await prisma.loyaltyAccount.findUnique({
      where: { userId },
      select: {
        pointsBalance: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { id: true, points: true, reason: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        wallet,
        loyaltyPoints: loyalty?.pointsBalance ?? 0,
        loyaltyTransactions: loyalty?.transactions ?? [],
      },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/wallet]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
