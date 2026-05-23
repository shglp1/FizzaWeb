import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createPaymentSchema } from '@/lib/validations/payment';
import { isConfigured, createInvoice } from '@/lib/payments/myfatoorah';
import { PaymentGatewayError, mapGatewayErrorToResponse, buildSafeLogPayload } from '@/lib/payments/types';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 'payments:create', RATE_LIMITS.paymentCreate);
  if (!rl.allowed) return rateLimitResponse(rl);

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

    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    if (!isConfigured()) {
      return NextResponse.json(
        { data: null, error: { message: 'Payment gateway not configured. Contact support.' } },
        { status: 503 },
      );
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        user: { select: { email: true } },
      },
    });

    const customerName = profile?.fullName ?? 'Customer';
    const customerEmail = profile?.user?.email ?? '';

    if (parsed.data.purpose === 'WALLET_TOP_UP') {
      const amountSar = parsed.data.amountSar!;

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          id: randomUUID(),
          userId,
          amountSar,
          status: 'PENDING',
          purpose: 'WALLET_TOP_UP',
          gateway: 'myfatoorah',
        },
      });

      let result: Awaited<ReturnType<typeof createInvoice>>;
      try {
        result = await createInvoice({
          amountSar,
          customerName,
          customerEmail,
          customerReference: payment.id,
          userId,
          purpose: 'WALLET_TOP_UP',
        });
      } catch (invoiceError) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });

        const safeLog = buildSafeLogPayload(
          { userId, purpose: 'WALLET_TOP_UP', amountSar, paymentId: payment.id },
          invoiceError,
        );
        console.error('[POST /api/payments/create] WALLET_TOP_UP invoice failed', safeLog);

        await prisma.auditLog.create({
          data: {
            id: randomUUID(),
            userId,
            action: 'WALLET_TOP_UP_INVOICE_FAILED',
            details: JSON.stringify({
              amountSar,
              paymentId: payment.id,
              reason: invoiceError instanceof PaymentGatewayError ? invoiceError.reason : 'UNKNOWN',
              error:
                invoiceError instanceof Error ? invoiceError.message : 'Invoice creation failed',
            }),
          },
        });

        const errPayload = mapGatewayErrorToResponse(invoiceError);
        return NextResponse.json({ data: null, error: errPayload }, { status: 502 });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: { invoiceId: result.invoiceId, externalRef: result.invoiceId, invoiceUrl: result.invoiceUrl },
      });

      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId,
          action: 'WALLET_TOP_UP_INITIATED',
          details: JSON.stringify({ amountSar, paymentId: payment.id }),
        },
      });

      return NextResponse.json({
        data: { paymentId: payment.id, invoiceUrl: result.invoiceUrl, status: 'PENDING' },
        error: null,
      });
    }

    // SUBSCRIPTION_PAYMENT
    const { subscriptionId } = parsed.data;

    const subscription = await prisma.userSubscription.findFirst({
      where: { userId, id: subscriptionId, NOT: { paymentStatus: 'PAID' } },
      select: { id: true, finalPriceSar: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found or already paid' } },
        { status: 404 },
      );
    }

    // Use the price snapshot recorded at subscription creation — never recalculate
    // from current package/add-on prices, which may have changed since then.
    const total = Number(subscription.finalPriceSar);

    if (total <= 0) {
      return NextResponse.json(
        { data: null, error: { message: 'Could not determine subscription amount. Contact support.' } },
        { status: 400 },
      );
    }

    // Check for existing PENDING payment
    const existingPayment = await prisma.payment.findFirst({
      where: { subscriptionId: subscriptionId!, status: 'PENDING' },
      select: { id: true, invoiceId: true, invoiceUrl: true, status: true },
    });

    if (existingPayment) {
      return NextResponse.json({
        data: {
          paymentId: existingPayment.id,
          invoiceId: existingPayment.invoiceId,
          invoiceUrl: existingPayment.invoiceUrl ?? null,
          status: 'PENDING',
          message: 'Payment already initiated',
        },
        error: null,
      });
    }

    // Create new payment
    const payment = await prisma.payment.create({
      data: {
        id: randomUUID(),
        userId,
        subscriptionId: subscriptionId!,
        amountSar: total,
        status: 'PENDING',
        purpose: 'SUBSCRIPTION_PAYMENT',
        gateway: 'myfatoorah',
      },
    });

    let result: Awaited<ReturnType<typeof createInvoice>>;
    try {
      result = await createInvoice({
        amountSar: total,
        customerName,
        customerEmail,
        customerReference: payment.id,
        userId,
        purpose: 'SUBSCRIPTION_PAYMENT',
      });
    } catch (invoiceError) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });

      const safeLog = buildSafeLogPayload(
        { userId, purpose: 'SUBSCRIPTION_PAYMENT', amountSar: total, paymentId: payment.id },
        invoiceError,
      );
      console.error('[POST /api/payments/create] SUBSCRIPTION_PAYMENT invoice failed', safeLog);

      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId,
          action: 'SUBSCRIPTION_PAYMENT_INVOICE_FAILED',
          details: JSON.stringify({
            subscriptionId,
            paymentId: payment.id,
            reason: invoiceError instanceof PaymentGatewayError ? invoiceError.reason : 'UNKNOWN',
            error:
              invoiceError instanceof Error ? invoiceError.message : 'Invoice creation failed',
          }),
        },
      });

      const errPayload = mapGatewayErrorToResponse(invoiceError);
      return NextResponse.json({ data: null, error: errPayload }, { status: 502 });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { invoiceId: result.invoiceId, externalRef: result.invoiceId, invoiceUrl: result.invoiceUrl },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId,
        action: 'SUBSCRIPTION_PAYMENT_INITIATED',
        details: JSON.stringify({ subscriptionId, amountSar: total, paymentId: payment.id }),
      },
    });

    return NextResponse.json({
      data: { paymentId: payment.id, invoiceUrl: result.invoiceUrl, status: 'PENDING' },
      error: null,
    });
  } catch (error) {
    console.error('[POST /api/payments/create]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
