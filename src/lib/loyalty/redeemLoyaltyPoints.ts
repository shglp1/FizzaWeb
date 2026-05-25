import 'server-only';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';

/** Deduct loyalty points after successful payment — idempotent per paymentId. */
export async function redeemLoyaltyPointsOnPayment(
  tx: Prisma.TransactionClient,
  opts: {
    userId: string;
    subscriptionId: string;
    paymentId: string;
    pointsToRedeem: number;
  },
): Promise<void> {
  if (opts.pointsToRedeem <= 0) return;

  const existing = await tx.loyaltyTransaction.findFirst({
    where: { paymentId: opts.paymentId },
  });
  if (existing) return;

  const account = await tx.loyaltyAccount.findUnique({ where: { userId: opts.userId } });
  if (!account || account.pointsBalance < opts.pointsToRedeem) {
    throw new Error('Insufficient loyalty points at redemption time');
  }

  await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: { pointsBalance: { decrement: opts.pointsToRedeem } },
  });

  await tx.loyaltyTransaction.create({
    data: {
      id: randomUUID(),
      accountId: account.id,
      points: -opts.pointsToRedeem,
      reason: 'REDEEMED',
      paymentId: opts.paymentId,
      subscriptionId: opts.subscriptionId,
    },
  });
}
