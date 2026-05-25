import 'server-only';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';

const DEFAULT_POINTS_PER_SAR = 1;

/** Award loyalty points inside an existing transaction (subscription / wallet payment). */
export async function awardLoyaltyPointsForPayment(
  tx: Prisma.TransactionClient,
  userId: string,
  amountSar: number,
  reason: string,
): Promise<number> {
  if (amountSar <= 0) return 0;

  const row = await tx.systemConfiguration.findUnique({ where: { key: 'loyaltyPointsPerSar' } });
  const pointsPerSar =
    typeof row?.value === 'number' && row.value > 0 ? row.value : DEFAULT_POINTS_PER_SAR;
  const points = Math.floor(amountSar * pointsPerSar);
  if (points <= 0) return 0;

  const account = await tx.loyaltyAccount.upsert({
    where: { userId },
    create: { id: randomUUID(), userId, pointsBalance: points },
    update: { pointsBalance: { increment: points } },
  });

  await tx.loyaltyTransaction.create({
    data: { id: randomUUID(), accountId: account.id, points, reason },
  });

  return points;
}
