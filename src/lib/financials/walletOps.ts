/**
 * Shared wallet operations — used by manual adjustments and trip credits.
 */
import type { Prisma, WalletTransactionSource } from '@prisma/client';
import { prisma } from '../prisma.ts';

export class WalletOperationError extends Error {
  code: 'USER_NOT_FOUND' | 'NEGATIVE_BALANCE' | 'INVALID_AMOUNT';

  constructor(message: string, code: WalletOperationError['code']) {
    super(message);
    this.name = 'WalletOperationError';
    this.code = code;
  }
}

export async function applyWalletAdjustment(input: {
  userId: string;
  amountSar: number;
  reason: string;
  adminUserId: string;
  source?: WalletTransactionSource;
  tripId?: string | null;
  idempotencyKey?: string | null;
  tx: Prisma.TransactionClient;
}) {
  const profile = await input.tx.profile.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!profile) throw new WalletOperationError('User not found', 'USER_NOT_FOUND');
  if (input.amountSar === 0) throw new WalletOperationError('Amount cannot be zero', 'INVALID_AMOUNT');

  if (input.idempotencyKey) {
    const existing = await input.tx.walletTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      const wallet = await input.tx.wallet.findUnique({ where: { userId: input.userId } });
      return { duplicate: true as const, transaction: existing, newBalanceSar: Number(wallet?.balanceSar ?? 0) };
    }
  }

  const wallet = await input.tx.wallet.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, balanceSar: 0 },
    update: {},
    select: { id: true, balanceSar: true },
  });

  const newBalance = Math.round((Number(wallet.balanceSar) + input.amountSar) * 100) / 100;
  if (newBalance < 0) throw new WalletOperationError('Balance cannot go negative', 'NEGATIVE_BALANCE');

  await input.tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceSar: newBalance },
  });

  const txRow = await input.tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      tripId: input.tripId ?? null,
      amountSar: Math.abs(input.amountSar),
      txType: input.amountSar > 0 ? 'CREDIT' : 'DEBIT',
      source: input.source ?? 'MANUAL_ADJUSTMENT',
      idempotencyKey: input.idempotencyKey ?? null,
      adminUserId: input.adminUserId,
      reason: input.reason,
      description: input.source === 'MANUAL_ADJUSTMENT'
        ? `Admin adjustment: ${input.reason}`
        : input.reason,
    },
  });

  return { duplicate: false as const, transaction: txRow, newBalanceSar: newBalance };
}
