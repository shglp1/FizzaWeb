import 'server-only';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { computePromoDiscount, evaluatePromoEligibility } from '@/lib/promo/promoCodeRules';

export { computePromoDiscount, evaluatePromoEligibility } from '@/lib/promo/promoCodeRules';
export type { PromoEligibilityResult } from '@/lib/promo/promoCodeRules';

export type PromoValidationResult =
  | { ok: true; promo: { id: string; code: string; discountPercent: number; partnerName: string | null } }
  | { ok: false; message: string };

export async function validatePromoCode(
  code: string,
  userId?: string,
): Promise<PromoValidationResult> {
  const { prisma } = await import('@/lib/prisma');
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, message: 'Enter a promo code' };

  const promo = await prisma.promoCode.findUnique({ where: { code: normalized } });
  if (!promo || !promo.isActive) {
    return { ok: false, message: 'This promo code is not valid' };
  }

  const prior = userId
    ? await prisma.promoCodeRedemption.findFirst({ where: { promoCodeId: promo.id, userId } })
    : null;

  const eligibility = evaluatePromoEligibility(promo, Boolean(prior));
  if (!eligibility.ok) return eligibility;

  return {
    ok: true,
    promo: {
      id: promo.id,
      code: promo.code,
      discountPercent: promo.discountPercent,
      partnerName: promo.partnerName,
    },
  };
}

/** Record redemption and update promo aggregates when payment succeeds. */
export async function recordPromoRedemption(
  tx: Prisma.TransactionClient,
  opts: {
    promoCodeId: string;
    userId: string;
    subscriptionId: string;
    paymentId?: string;
    subtotalSar: number;
    discountSar: number;
    finalSar: number;
  },
): Promise<void> {
  if (opts.paymentId) {
    const existing = await tx.promoCodeRedemption.findFirst({
      where: { paymentId: opts.paymentId },
    });
    if (existing) return;
  }

  await tx.promoCodeRedemption.create({
    data: {
      id: randomUUID(),
      promoCodeId: opts.promoCodeId,
      userId: opts.userId,
      subscriptionId: opts.subscriptionId,
      paymentId: opts.paymentId ?? null,
      subtotalSar: opts.subtotalSar,
      discountSar: opts.discountSar,
      finalSar: opts.finalSar,
    },
  });

  await tx.promoCode.update({
    where: { id: opts.promoCodeId },
    data: {
      useCount: { increment: 1 },
      totalDiscountSar: { increment: opts.discountSar },
      totalPaidSar: { increment: opts.finalSar },
    },
  });
}
