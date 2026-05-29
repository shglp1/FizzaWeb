import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { applyWalletAdjustment, WalletOperationError } from '@/lib/financials/walletOps';

const adjustmentSchema = z.object({
  userId: z.string().uuid(),
  amountSar: z.number().refine((n) => n !== 0, { message: 'Amount cannot be zero' }),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
  tripId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = adjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { userId, amountSar, reason, tripId } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const applied = await applyWalletAdjustment({
        userId,
        amountSar,
        reason,
        adminUserId: auth.userId,
        source: 'MANUAL_ADJUSTMENT',
        tripId: tripId ?? null,
        tx,
      });

      if (!applied.duplicate) {
        await tx.auditLog.create({
          data: {
            userId: auth.userId,
            action: 'ADMIN_WALLET_ADJUSTED',
            details: JSON.stringify({
              targetUserId: userId,
              amountSar,
              reason,
              tripId: tripId ?? null,
              walletTransactionId: applied.transaction.id,
              source: 'MANUAL_ADJUSTMENT',
            }),
          },
        });

        await tx.notification.create({
          data: {
            userId,
            title: amountSar > 0 ? 'Wallet credited' : 'Wallet debited',
            message: `Your wallet has been ${amountSar > 0 ? 'credited' : 'debited'} SAR ${Math.abs(amountSar).toFixed(2)} by an administrator. Reason: ${reason}`,
            type: 'WALLET_TOP_UP',
          },
        });
      }

      return applied;
    });

    return NextResponse.json({
      data: {
        newBalanceSar: result.newBalanceSar,
        transaction: result.transaction,
        duplicate: result.duplicate,
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof WalletOperationError) {
      const status = err.code === 'USER_NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ data: null, error: { message: err.message } }, { status });
    }
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ data: null, error: { message: msg } }, { status: 500 });
  }
}
