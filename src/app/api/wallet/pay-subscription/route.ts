import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { paySubscriptionSchema } from '@/lib/validations/wallet';
import { awardLoyaltyPointsForPayment } from '@/lib/loyalty/awardLoyaltyPoints';
import { redeemLoyaltyPointsOnPayment } from '@/lib/loyalty/redeemLoyaltyPoints';
import { recordPromoRedemption } from '@/lib/promo/promoCode';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsed = paySubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const { subscriptionId } = parsed.data;

    // Find subscription belonging to this user
    const subscription = await prisma.userSubscription.findFirst({
      where: { id: subscriptionId, userId },
      select: {
        id: true,
        paymentStatus: true,
        finalPriceSar: true,
        subtotalSar: true,
        promoDiscountSar: true,
        promoCodeId: true,
        loyaltyPointsRedeemed: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found' } },
        { status: 404 },
      );
    }

    if (subscription.paymentStatus === 'PAID') {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription already paid' } },
        { status: 409 },
      );
    }

    if (subscription.paymentStatus !== 'PENDING') {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription is not in a payable state' } },
        { status: 400 },
      );
    }

    // Use the price snapshot recorded at subscription creation — never recalculate
    // from current package/add-on prices, which may have changed since then.
    const total = Number(subscription.finalPriceSar);

    if (total <= 0) {
      return NextResponse.json(
        {
          data: null,
          error: { message: 'Could not determine subscription amount. Contact support.' },
        },
        { status: 400 },
      );
    }

    // Find wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return NextResponse.json(
        { data: null, error: { message: 'Wallet not found' } },
        { status: 404 },
      );
    }

    if (Number(wallet.balanceSar) < total) {
      return NextResponse.json(
        { data: null, error: { message: 'Insufficient wallet balance' } },
        { status: 400 },
      );
    }

    let newBalance = 0;
    let paymentId = randomUUID();

    await prisma.$transaction(async (tx) => {
      // Re-read wallet inside tx for pessimistic check
      const walletInTx = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!walletInTx) throw new Error('Wallet not found');

      newBalance = Number(walletInTx.balanceSar) - total;
      if (newBalance < 0) throw new Error('Insufficient balance');

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceSar: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          id: randomUUID(),
          walletId: wallet.id,
          amountSar: total,
          txType: 'SUBSCRIPTION_PAYMENT',
          source: 'SUBSCRIPTION_PAYMENT',
          description: 'Payment for subscription',
        },
      });

      await tx.payment.create({
        data: {
          id: paymentId,
          userId,
          subscriptionId,
          amountSar: total,
          status: 'PAID',
          gateway: 'wallet',
          purpose: 'SUBSCRIPTION_PAYMENT',
        },
      });

      await tx.userSubscription.update({
        where: { id: subscriptionId },
        data: { paymentStatus: 'PAID', status: 'ACTIVE' },
      });

      if (subscription.promoCodeId) {
        const subtotal = Number(subscription.subtotalSar ?? subscription.finalPriceSar);
        const discount = Number(subscription.promoDiscountSar ?? 0);
        await recordPromoRedemption(tx, {
          promoCodeId: subscription.promoCodeId,
          userId,
          subscriptionId,
          paymentId,
          subtotalSar: subtotal,
          discountSar: discount,
          finalSar: total,
        });
      }

      if (subscription.loyaltyPointsRedeemed && subscription.loyaltyPointsRedeemed > 0) {
        await redeemLoyaltyPointsOnPayment(tx, {
          userId,
          subscriptionId,
          paymentId,
          pointsToRedeem: subscription.loyaltyPointsRedeemed,
        });
      }

      const points = await awardLoyaltyPointsForPayment(tx, userId, total, 'Subscription payment (wallet)');

      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId,
          title: 'Subscription Paid',
          message: points > 0
            ? `Your subscription has been activated. You earned ${points} loyalty points.`
            : 'Your subscription has been activated.',
          type: 'SUBSCRIPTION_PAYMENT',
        },
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          userId,
          action: 'SUBSCRIPTION_WALLET_PAYMENT',
          details: JSON.stringify({ subscriptionId, amountSar: total }),
        },
      });
    });

    return NextResponse.json({
      data: { message: 'Subscription paid successfully', balanceSar: newBalance },
      error: null,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already paid')) {
        return NextResponse.json(
          { data: null, error: { message: error.message } },
          { status: 409 },
        );
      }
      if (error.message.includes('Insufficient')) {
        return NextResponse.json(
          { data: null, error: { message: error.message } },
          { status: 400 },
        );
      }
    }
    console.error('[POST /api/wallet/pay-subscription]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
