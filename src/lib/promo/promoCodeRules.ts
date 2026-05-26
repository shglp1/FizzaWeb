export type PromoEligibilityResult =
  | { ok: true }
  | { ok: false; message: string };

export function computePromoDiscount(subtotalSar: number, discountPercent: number): number {
  if (subtotalSar <= 0 || discountPercent <= 0) return 0;
  const pct = Math.min(100, Math.max(1, Math.round(discountPercent)));
  return Math.round(subtotalSar * (pct / 100) * 100) / 100;
}

export function remainingPromoUses(promo: { maxUses: number | null; useCount: number }): number | null {
  if (promo.maxUses == null) return null;
  return Math.max(0, promo.maxUses - promo.useCount);
}

export function evaluatePromoEligibility(
  promo: {
    isActive: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    useCount: number;
  },
  alreadyUsedByUser: boolean,
): PromoEligibilityResult {
  if (!promo.isActive) {
    return { ok: false, message: 'This promo code is not valid' };
  }
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: 'This promo code has expired' };
  }
  if (promo.maxUses != null && promo.useCount >= promo.maxUses) {
    return { ok: false, message: 'This promo code has reached its usage limit' };
  }
  if (alreadyUsedByUser) {
    return { ok: false, message: 'You have already used this promo code' };
  }
  return { ok: true };
}
