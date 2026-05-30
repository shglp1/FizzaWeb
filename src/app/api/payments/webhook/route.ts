import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPaymentStatus, getWebhookSecret } from '@/lib/payments/myfatoorah';
import { applyPaymentOutcome } from '@/lib/payments/processPaymentStatus';
import { triggerTripGenerationAfterPayment } from '@/lib/dispatch/triggerAfterPayment';
import { webhookPayloadSchema } from '@/lib/validations/payment';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

// ─── HMAC signature verification ──────────────────────────────────────────────
//
// MyFatoorah sends a `Signature` header containing HMAC-SHA256 of the raw
// request body, keyed with MYFATOORAH_WEBHOOK_SECRET.
// If the secret is set in env, we reject any request whose signature does not
// match. If the secret is not configured (development / local testing without
// a real MyFatoorah account) we skip verification and log a warning.

function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getWebhookSecret();
  if (!secret) {
    // Fail CLOSED in production: a missing webhook secret must never allow
    // unauthenticated payloads to drive payment processing. Only skip
    // verification in non-production (dev/staging without portal access).
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] MYFATOORAH_WEBHOOK_SECRET is not set in production — rejecting webhook');
      return false;
    }
    console.warn('[webhook] MYFATOORAH_WEBHOOK_SECRET is not set — skipping signature verification (non-production only)');
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHeader, 'hex'));
  } catch {
    // Buffer lengths differ — invalid signature format
    return false;
  }
}

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
  // Coarse rate-limit guard against trivial DoS. The primary protection is
  // HMAC-SHA256 signature verification using MYFATOORAH_WEBHOOK_SECRET below.
  const rl = checkRateLimit(request, 'payments:webhook', RATE_LIMITS.webhookPayment);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Read raw body text for HMAC verification before JSON parsing
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Could not read request body' } },
      { status: 400 },
    );
  }

  // Verify HMAC signature
  const signatureHeader = request.headers.get('Signature');
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    console.warn('[webhook] Invalid or missing Signature header — rejecting request');
    // Return 200 to prevent MyFatoorah from knowing the exact rejection reason,
    // but do not process the payload.
    return NextResponse.json({ received: false, reason: 'signature_invalid' }, { status: 200 });
  }

  try {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
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
    const processResult = await applyPaymentOutcome(payment, result.status, PaymentId, result.invoiceValue);

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
