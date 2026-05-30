import 'server-only';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { awardLoyaltyPointsForPayment } from '@/lib/loyalty/awardLoyaltyPoints';
import { redeemLoyaltyPointsOnPayment } from '@/lib/loyalty/redeemLoyaltyPoints';
import { recordPromoRedemption } from '@/lib/promo/promoCode';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProcessOutcome =
  | 'PAID'
  | 'FAILED'
  | 'PENDING'
  | 'ALREADY_PROCESSED'
  | 'AMOUNT_MISMATCH';

export type ProcessResult = {
  /** What happened as a result of processing. */
  outcome: ProcessOutcome;
  /** True if a wallet balance was credited (WALLET_TOP_UP, first time). */
  walletUpdated: boolean;
  /** True if a subscription was activated (SUBSCRIPTION_PAYMENT, first time). */
  subscriptionActivated: boolean;
  /** The subscription DB id, if relevant. */
  subscriptionId: string | null;
  /** Our internal Payment DB id. */
  paymentDbId: string;
};

type PaymentRow = {
  id: string;
  userId: string;
  purpose: string;
  subscriptionId: string | null;
  // Prisma Decimal serialises to string in JSON; accept both forms
  amountSar: { toString(): string } | number | string;
  status: string;
};

// ─── Shared payment outcome helper ───────────────────────────────────────────

/**
 * Apply a MyFatoorah payment outcome to an existing Payment DB record.
 *
 * This is the single source of truth for the business logic that follows a
 * payment — used by both the server-to-server webhook (POST) and the
 * browser-return callback (GET).
 *
 * Idempotent: if payment.status is already PAID the function returns
 * ALREADY_PROCESSED without touching the DB again, so calling it twice is safe.
 *
 * @param payment         - Payment row fetched from DB before calling.
 * @param myfatoorahStatus - Status returned by MyFatoorah GetPaymentStatus.
 * @param myfatoorahPaymentId - Optional PaymentId from MyFatoorah (stored for traceability).
 * @param gatewayInvoiceValue - Optional settlement amount from the gateway. When
 *   provided for a PAID outcome it is cross-checked against the stored
 *   payment.amountSar; a mismatch aborts crediting (returns AMOUNT_MISMATCH).
 */
export async function applyPaymentOutcome(
  payment: PaymentRow,
  myfatoorahStatus: 'PAID' | 'FAILED' | 'PENDING',
  myfatoorahPaymentId?: string,
  gatewayInvoiceValue?: number | null,
): Promise<ProcessResult> {
  // ── Idempotency guard ─────────────────────────────────────────────────────
  if (payment.status === 'PAID') {
    return {
      outcome: 'ALREADY_PROCESSED',
      walletUpdated: false,
      subscriptionActivated: false,
      subscriptionId: payment.subscriptionId,
      paymentDbId: payment.id,
    };
  }

  // ── Handle PAID ───────────────────────────────────────────────────────────
  if (myfatoorahStatus === 'PAID') {
    // Cross-check the gateway settlement amount against our stored amount before
    // crediting. Guards against tampered/mismatched invoices driving a credit
    // that differs from what the user actually paid.
    if (gatewayInvoiceValue !== undefined && gatewayInvoiceValue !== null) {
      const expected = Number(payment.amountSar);
      const tolerance = 0.01; // allow sub-cent rounding differences
      if (!Number.isFinite(expected) || Math.abs(gatewayInvoiceValue - expected) > tolerance) {
        await prisma.auditLog.create({
          data: {
            id: randomUUID(),
            userId: payment.userId,
            action: 'PAYMENT_AMOUNT_MISMATCH',
            details: JSON.stringify({
              paymentDbId: payment.id,
              expectedAmountSar: expected,
              gatewayInvoiceValue,
              myfatoorahPaymentId,
            }),
          },
        });
        return {
          outcome: 'AMOUNT_MISMATCH',
          walletUpdated: false,
          subscriptionActivated: false,
          subscriptionId: payment.subscriptionId,
          paymentDbId: payment.id,
        };
      }
    }

    let walletUpdated = false;
    let subscriptionActivated = false;
    let alreadyClaimed = false;

    await prisma.$transaction(async (tx) => {
      // Atomic idempotency claim: flip PENDING -> PAID as the FIRST write so
      // concurrent webhook + callback deliveries serialize on this row. Only the
      // processor whose update affects a row proceeds to credit the wallet /
      // activate the subscription; the loser exits without side effects. This
      // prevents double-credit without requiring a schema migration.
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          ...(myfatoorahPaymentId ? { paymentId: myfatoorahPaymentId } : {}),
        },
      });
      if (claim.count === 0) {
        alreadyClaimed = true;
        return;
      }

      // ── Wallet top-up ───────────────────────────────────────────────────
      if (payment.purpose === 'WALLET_TOP_UP') {
        let wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { id: randomUUID(), userId: payment.userId, balanceSar: 0 },
          });
        }

        const newBalance = Number(wallet.balanceSar) + Number(payment.amountSar);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceSar: newBalance },
        });

        await tx.walletTransaction.create({
          data: {
            id: randomUUID(),
            walletId: wallet.id,
            paymentId: payment.id,
            amountSar: payment.amountSar as never, // Prisma Decimal
            txType: 'TOP_UP',
            source: 'TOP_UP',
            description: 'Online top-up via MyFatoorah',
          },
        });

        await tx.notification.create({
          data: {
            id: randomUUID(),
            userId: payment.userId,
            title: 'Wallet Topped Up',
            message: `SAR ${Number(payment.amountSar).toFixed(2)} added to your wallet.`,
            type: 'WALLET_TOP_UP',
          },
        });

        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            userId: payment.userId,
            action: 'WALLET_TOP_UP_CONFIRMED',
            details: JSON.stringify({
              amountSar: Number(payment.amountSar),
              newBalance,
              paymentDbId: payment.id,
              myfatoorahPaymentId,
            }),
          },
        });

        walletUpdated = true;
      }

      // ── Subscription payment ────────────────────────────────────────────
      if (payment.purpose === 'SUBSCRIPTION_PAYMENT' && payment.subscriptionId) {
        const sub = await tx.userSubscription.findUnique({
          where: { id: payment.subscriptionId },
          select: {
            id: true,
            promoCodeId: true,
            subtotalSar: true,
            promoDiscountSar: true,
            loyaltyPointsRedeemed: true,
            finalPriceSar: true,
          },
        });

        await tx.userSubscription.update({
          where: { id: payment.subscriptionId },
          data: { paymentStatus: 'PAID', status: 'ACTIVE' },
        });

        if (sub?.loyaltyPointsRedeemed && sub.loyaltyPointsRedeemed > 0) {
          await redeemLoyaltyPointsOnPayment(tx, {
            userId: payment.userId,
            subscriptionId: sub.id,
            paymentId: payment.id,
            pointsToRedeem: sub.loyaltyPointsRedeemed,
          });
        }

        if (sub?.promoCodeId) {
          const subtotal = Number(sub.subtotalSar ?? sub.finalPriceSar);
          const discount = Number(sub.promoDiscountSar ?? 0);
          const finalSar = Number(sub.finalPriceSar);
          await recordPromoRedemption(tx, {
            promoCodeId: sub.promoCodeId,
            userId: payment.userId,
            subscriptionId: sub.id,
            paymentId: payment.id,
            subtotalSar: subtotal,
            discountSar: discount,
            finalSar,
          });
        }

        const points = await awardLoyaltyPointsForPayment(
          tx,
          payment.userId,
          Number(payment.amountSar),
          'Subscription payment',
        );

        await tx.notification.create({
          data: {
            id: randomUUID(),
            userId: payment.userId,
            title: 'Subscription Activated',
            message: points > 0
              ? `Your subscription is now active. You earned ${points} loyalty points.`
              : 'Your subscription payment was successful and your subscription is now active.',
            type: 'SUBSCRIPTION_PAYMENT',
          },
        });

        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            userId: payment.userId,
            action: 'ONLINE_PAYMENT_CONFIRMED',
            details: JSON.stringify({
              myfatoorahPaymentId,
              paymentDbId: payment.id,
              subscriptionId: payment.subscriptionId,
              amountSar: Number(payment.amountSar),
            }),
          },
        });

        subscriptionActivated = true;
      }
    });

    // Lost the concurrent claim — another processor already finalized this payment.
    if (alreadyClaimed) {
      return {
        outcome: 'ALREADY_PROCESSED',
        walletUpdated: false,
        subscriptionActivated: false,
        subscriptionId: payment.subscriptionId,
        paymentDbId: payment.id,
      };
    }

    return {
      outcome: 'PAID',
      walletUpdated,
      subscriptionActivated,
      subscriptionId: payment.subscriptionId,
      paymentDbId: payment.id,
    };
  }

  // ── Handle FAILED ─────────────────────────────────────────────────────────
  if (myfatoorahStatus === 'FAILED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    await prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: payment.userId,
        title: 'Payment Failed',
        message: 'Your payment was not successful. Please try again.',
        type: payment.purpose === 'WALLET_TOP_UP' ? 'WALLET_TOP_UP' : 'SUBSCRIPTION_PAYMENT',
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: payment.userId,
        action: 'ONLINE_PAYMENT_FAILED',
        details: JSON.stringify({
          myfatoorahPaymentId,
          paymentDbId: payment.id,
          amountSar: Number(payment.amountSar),
        }),
      },
    });

    return {
      outcome: 'FAILED',
      walletUpdated: false,
      subscriptionActivated: false,
      subscriptionId: payment.subscriptionId,
      paymentDbId: payment.id,
    };
  }

  // ── PENDING — no DB changes ───────────────────────────────────────────────
  return {
    outcome: 'PENDING',
    walletUpdated: false,
    subscriptionActivated: false,
    subscriptionId: payment.subscriptionId,
    paymentDbId: payment.id,
  };
}
