import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createPaymentSchema } from '@/lib/validations/payment';
import { isConfigured, createInvoice } from '@/lib/payments/myfatoorah';

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
        });
      } catch (invoiceError) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });
        await prisma.auditLog.create({
          data: {
            id: randomUUID(),
            userId,
            action: 'WALLET_TOP_UP_INVOICE_FAILED',
            details: JSON.stringify({
              amountSar,
              paymentId: payment.id,
              error:
                invoiceError instanceof Error ? invoiceError.message : 'Invoice creation failed',
            }),
          },
        });
        return NextResponse.json(
          { data: null, error: { message: 'Failed to create payment invoice. Please try again.' } },
          { status: 502 },
        );
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: { invoiceId: result.invoiceId, externalRef: result.invoiceId },
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
      include: {
        package: { select: { priceSar: true } },
        addOns: { select: { addOn: { select: { priceSar: true } } } },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found or already paid' } },
        { status: 404 },
      );
    }

    const packagePrice = Number(subscription.package?.priceSar ?? 0);
    const addOnTotal = (subscription.addOns ?? []).reduce(
      (sum: number, a: { addOn: { priceSar: unknown } }) => sum + Number(a.addOn.priceSar),
      0,
    );
    const total = packagePrice + addOnTotal;

    if (total <= 0) {
      return NextResponse.json(
        { data: null, error: { message: 'Could not determine subscription amount. Contact support.' } },
        { status: 400 },
      );
    }

    // Check for existing PENDING payment
    const existingPayment = await prisma.payment.findFirst({
      where: { subscriptionId: subscriptionId!, status: 'PENDING' },
      select: { id: true, invoiceId: true, status: true },
    });

    if (existingPayment) {
      return NextResponse.json({
        data: {
          paymentId: existingPayment.id,
          invoiceId: existingPayment.invoiceId,
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
      });
    } catch (invoiceError) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId,
          action: 'SUBSCRIPTION_PAYMENT_INVOICE_FAILED',
          details: JSON.stringify({
            subscriptionId,
            paymentId: payment.id,
            error:
              invoiceError instanceof Error ? invoiceError.message : 'Invoice creation failed',
          }),
        },
      });
      return NextResponse.json(
        { data: null, error: { message: 'Failed to create payment invoice. Please try again.' } },
        { status: 502 },
      );
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { invoiceId: result.invoiceId, externalRef: result.invoiceId },
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
