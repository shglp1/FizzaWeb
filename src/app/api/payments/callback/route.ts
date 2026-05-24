/**
 * GET /api/payments/callback
 *
 * Handles two flows:
 *
 * 1. Browser redirect from MyFatoorah after 3DS / payment page.
 *    MyFatoorah appends query params to CallBackUrl:
 *      ?paymentId={InvoiceId}&Id={PaymentId}
 *    We resolve the payment from either param and verify with GetPaymentStatus.
 *
 * 2. Manual "Verify Payment" action from the subscriptions page.
 *    The UI passes one of:
 *      ?invoiceId={our stored invoiceId}
 *      ?subscriptionId={subscriptionId}  → we look up the pending payment
 *
 * Both flows share the same applyPaymentOutcome() helper used by the webhook.
 * Idempotent: verifying an already-PAID payment returns ALREADY_PROCESSED safely.
 *
 * NOTE: The webhook at /api/payments/webhook is POST-only (server-to-server).
 *       Browser redirects must NOT go to the webhook URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { getPaymentStatus } from '@/lib/payments/myfatoorah';
import { applyPaymentOutcome } from '@/lib/payments/processPaymentStatus';
import { triggerTripGenerationAfterPayment } from '@/lib/dispatch/triggerAfterPayment';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'payments:callback', RATE_LIMITS.paymentCallback);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);

    // ── Resolve MyFatoorah key from query params ─────────────────────────────
    //
    // Priority:
    //  1. Id        → MyFatoorah PaymentId (transaction ID)        → KeyType: 'PaymentId'
    //  2. paymentId → MyFatoorah InvoiceId (confusingly named)     → KeyType: 'InvoiceId'
    //  3. invoiceId → our stored invoiceId (manual verify)         → KeyType: 'InvoiceId'
    //  4. subscriptionId → look up pending payment, use its invoiceId

    const idParam = searchParams.get('Id');
    const paymentIdParam = searchParams.get('paymentId');
    const invoiceIdParam = searchParams.get('invoiceId');
    const subscriptionIdParam = searchParams.get('subscriptionId');

    let myfatoorahKey: string;
    let myfatoorahKeyType: 'PaymentId' | 'InvoiceId';

    if (idParam) {
      // Standard MyFatoorah callback: ?paymentId=...&Id=...
      // `Id` is the real PaymentId (transaction ID)
      myfatoorahKey = idParam;
      myfatoorahKeyType = 'PaymentId';
    } else if (paymentIdParam) {
      // MyFatoorah uses "paymentId" to mean InvoiceId in their redirect URL
      myfatoorahKey = paymentIdParam;
      myfatoorahKeyType = 'InvoiceId';
    } else if (invoiceIdParam) {
      // Manual verify: our stored invoiceId
      myfatoorahKey = invoiceIdParam;
      myfatoorahKeyType = 'InvoiceId';
    } else if (subscriptionIdParam) {
      // Manual verify via subscriptionId: look up pending payment
      const pending = await prisma.payment.findFirst({
        where: { subscriptionId: subscriptionIdParam, userId, status: 'PENDING' },
        select: { invoiceId: true },
      });
      if (!pending?.invoiceId) {
        return NextResponse.json(
          { data: null, error: { message: 'No pending payment found for this subscription.' } },
          { status: 404 },
        );
      }
      myfatoorahKey = pending.invoiceId;
      myfatoorahKeyType = 'InvoiceId';
    } else {
      return NextResponse.json(
        {
          data: null,
          error: { message: 'Missing required query param: Id, paymentId, invoiceId, or subscriptionId.' },
        },
        { status: 400 },
      );
    }

    // ── Verify with MyFatoorah ────────────────────────────────────────────────

    let result: Awaited<ReturnType<typeof getPaymentStatus>>;
    try {
      result = await getPaymentStatus(myfatoorahKey, myfatoorahKeyType);
    } catch (err) {
      console.error('[GET /api/payments/callback] getPaymentStatus failed', {
        userId,
        myfatoorahKeyType,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { data: null, error: { message: 'Unable to verify payment status. Please try again.' } },
        { status: 502 },
      );
    }

    // ── Find payment in DB ────────────────────────────────────────────────────

    const payment = await prisma.payment.findFirst({
      where: {
        userId, // Ensures users can only verify their own payments
        OR: [
          { invoiceId: result.invoiceId },
          { externalRef: result.invoiceId },
        ],
      },
    });

    if (!payment) {
      return NextResponse.json(
        { data: null, error: { message: 'Payment record not found.' } },
        { status: 404 },
      );
    }

    // ── Apply outcome via shared helper (idempotent) ──────────────────────────

    const processResult = await applyPaymentOutcome(
      payment,
      result.status,
      myfatoorahKeyType === 'PaymentId' ? myfatoorahKey : undefined,
    );

    if (processResult.subscriptionActivated && processResult.subscriptionId) {
      await triggerTripGenerationAfterPayment(processResult.subscriptionId);
    }

    // Audit log — separate from the webhook audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId,
        action: 'PAYMENT_CALLBACK_PROCESSED',
        details: JSON.stringify({
          myfatoorahKeyType,
          outcome: processResult.outcome,
          myfatoorahStatus: result.status,
          paymentDbId: payment.id,
          subscriptionId: processResult.subscriptionId,
        }),
      },
    });

    return NextResponse.json({
      data: {
        outcome: processResult.outcome,
        status: result.status,
        paymentId: payment.id,
        purpose: payment.purpose,
        subscriptionId: processResult.subscriptionId,
        walletUpdated: processResult.walletUpdated,
        subscriptionActivated: processResult.subscriptionActivated,
      },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/payments/callback]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
