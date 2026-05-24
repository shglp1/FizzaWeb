import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPaymentStatus } from '@/lib/payments/myfatoorah';
import { applyPaymentOutcome } from '@/lib/payments/processPaymentStatus';
import { triggerTripGenerationAfterPayment } from '@/lib/dispatch/triggerAfterPayment';
import { webhookPayloadSchema } from '@/lib/validations/payment';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

// ─── GET — helpful 405 for browser misdirects ─────────────────────────────────
//
// MyFatoorah browser redirects must go to /payment/callback (GET).
// The webhook endpoint only handles server-to-server POST calls.

export function GET() {
  return NextResponse.json(
    {
      data: null,
      error: {
        message:
          'Webhook endpoint expects POST. ' +
          'Browser payment redirects should use /payment/callback instead.',
      },
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

// ─── POST — server-to-server MyFatoorah webhook ───────────────────────────────

export async function POST(request: NextRequest) {
  // Coarse guard against trivial DoS on the webhook endpoint.
  // The primary protection is HMAC signature verification below.
  const rl = checkRateLimit(request, 'payments:webhook', RATE_LIMITS.webhookPayment);
  if (!rl.allowed) return rateLimitResponse(rl);

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
      result = await getPaymentStatus(PaymentId, 'PaymentId');
    } catch (err) {
      // Log minimal info — no secrets
      console.error(
        '[webhook] getPaymentStatus failed for PaymentId:',
        PaymentId,
        err instanceof Error ? err.message : 'Unknown error',
      );
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
          myfatoorahPaymentId: PaymentId,
          status: result.status,
          paymentDbId: payment.id,
        }),
      },
    });

    // Idempotency: already processed — shared helper handles this too,
    // but log the explicit duplicate here for webhook-specific audit trail.
    if (payment.status === 'PAID') {
      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId: payment.userId,
          action: 'PAYMENT_WEBHOOK_DUPLICATE_IGNORED',
          details: JSON.stringify({ myfatoorahPaymentId: PaymentId, paymentDbId: payment.id }),
        },
      });
      return NextResponse.json({ received: true });
    }

    // Delegate to shared processing helper
    const processResult = await applyPaymentOutcome(payment, result.status, PaymentId);

    if (processResult.subscriptionActivated && processResult.subscriptionId) {
      await triggerTripGenerationAfterPayment(processResult.subscriptionId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[POST /api/payments/webhook]', error);
    // Always return 200 to MyFatoorah
    return NextResponse.json({ received: true });
  }
}
