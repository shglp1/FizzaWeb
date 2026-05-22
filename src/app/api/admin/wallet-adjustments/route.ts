import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

const adjustmentSchema = z.object({
  userId: z.string().uuid(),
  amountSar: z.number().refine((n) => n !== 0, { message: 'Amount cannot be zero' }),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
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

    const { userId, amountSar, reason } = parsed.data;

    const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { id: true } });
    if (!profile) {
      return NextResponse.json(
        { data: null, error: { message: 'User not found' } },
        { status: 404 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balanceSar: 0 },
        update: {},
        select: { id: true, balanceSar: true },
      });

      const newBalance = Number(wallet.balanceSar) + amountSar;
      if (newBalance < 0) throw new Error('Balance cannot go negative');

      const updated = await tx.wallet.update({
        where: { userId },
        data: { balanceSar: newBalance },
        select: { balanceSar: true },
      });

      const txRow = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amountSar: Math.abs(amountSar),
          txType: amountSar > 0 ? 'CREDIT' : 'DEBIT',
          description: `Admin adjustment: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'ADMIN_WALLET_ADJUSTED',
          details: JSON.stringify({ targetUserId: userId, amountSar, reason }),
        },
      });

      await tx.notification.create({
        data: {
          userId,
          title: amountSar > 0 ? 'Wallet Credited' : 'Wallet Debited',
          message: `Your wallet has been ${amountSar > 0 ? 'credited' : 'debited'} SAR ${Math.abs(amountSar).toFixed(2)} by an administrator. Reason: ${reason}`,
          type: 'WALLET_TOP_UP',
        },
      });

      return { newBalanceSar: Number(updated.balanceSar), transaction: txRow };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    const status = msg === 'Balance cannot go negative' ? 400 : 500;
    return NextResponse.json({ data: null, error: { message: msg } }, { status });
  }
}
