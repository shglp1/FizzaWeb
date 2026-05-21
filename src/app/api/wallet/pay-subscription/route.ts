import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { paySubscriptionSchema } from '@/lib/validations/wallet';

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
      include: {
        package: { select: { priceSar: true } },
        addOns: { select: { addOn: { select: { priceSar: true } } } },
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

    // Calculate amount server-side
    const packagePrice = Number(subscription.package?.priceSar ?? 0);
    const addOnTotal = (subscription.addOns ?? []).reduce(
      (sum: number, a: { addOn: { priceSar: unknown } }) => sum + Number(a.addOn.priceSar),
      0,
    );
    const total = packagePrice + addOnTotal;

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
          description: 'Payment for subscription',
        },
      });

      await tx.payment.create({
        data: {
          id: randomUUID(),
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

      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId,
          title: 'Subscription Paid',
          message: 'Your subscription has been activated.',
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
