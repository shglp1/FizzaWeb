import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPaymentStatus } from '@/lib/payments/myfatoorah';
import { webhookPayloadSchema } from '@/lib/validations/payment';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsed = webhookPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid webhook payload' } },
        { status: 400 },
      );
    }

    const { PaymentId } = parsed.data;

    // Verify status server-side
    let result: Awaited<ReturnType<typeof getPaymentStatus>>;
    try {
      result = await getPaymentStatus(PaymentId);
    } catch (err) {
      // Log minimal info — no secrets
      console.error('[webhook] getPaymentStatus failed for PaymentId:', PaymentId, err instanceof Error ? err.message : 'Unknown error');
      // Return 200 to prevent MyFatoorah retries revealing internal errors
      return NextResponse.json({ received: true });
    }

    // Find payment by invoiceId or externalRef
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { invoiceId: result.invoiceId },
          { externalRef: result.invoiceId },
        ],
      },
    });

    if (!payment) {
      // May be a test ping — acknowledge silently
      return NextResponse.json({ received: true });
    }

    // Log webhook receipt
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: payment.userId,
        action: 'PAYMENT_WEBHOOK_RECEIVED',
        details: JSON.stringify({
          paymentId: PaymentId,
          status: result.status,
          paymentDbId: payment.id,
        }),
      },
    });

    // Idempotency: if already processed
    if (payment.status === 'PAID') {
      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId: payment.userId,
          action: 'PAYMENT_WEBHOOK_DUPLICATE_IGNORED',
          details: JSON.stringify({ paymentId: PaymentId, paymentDbId: payment.id }),
        },
      });
      return NextResponse.json({ received: true });
    }

    if (result.status === 'PAID') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'PAID', paymentId: PaymentId },
        });

        if (payment.purpose === 'WALLET_TOP_UP') {
          // Upsert wallet
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
              amountSar: payment.amountSar,
              txType: 'TOP_UP',
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
              details: JSON.stringify({ amountSar: payment.amountSar, newBalance }),
            },
          });
        }

        if (payment.purpose === 'SUBSCRIPTION_PAYMENT' && payment.subscriptionId) {
          await tx.userSubscription.update({
            where: { id: payment.subscriptionId },
            data: { paymentStatus: 'PAID', status: 'ACTIVE' },
          });

          await tx.notification.create({
            data: {
              id: randomUUID(),
              userId: payment.userId,
              title: 'Subscription Activated',
              message: 'Your subscription payment was successful and your subscription is now active.',
              type: 'SUBSCRIPTION_PAYMENT',
            },
          });

          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              userId: payment.userId,
              action: 'ONLINE_PAYMENT_CONFIRMED',
              details: JSON.stringify({
                paymentId: PaymentId,
                paymentDbId: payment.id,
                subscriptionId: payment.subscriptionId,
                amountSar: payment.amountSar,
              }),
            },
          });
        }
      });
    } else if (result.status === 'FAILED') {
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
            paymentId: PaymentId,
            paymentDbId: payment.id,
            amountSar: payment.amountSar,
          }),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[POST /api/payments/webhook]', error);
    // Always return 200 to MyFatoorah
    return NextResponse.json({ received: true });
  }
}
