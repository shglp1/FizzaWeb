/**
 * POST /api/admin/trips/[id]/financial-review
 * Admin resolution for trip financial review (payroll eligibility gate).
 * CREDIT_PARENT triggers automated wallet credit (idempotent).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/session';
import {
  TripWalletCreditError,
  processNonCreditFinancialReview,
  processTripWalletCredit,
} from '@/lib/financials/tripWalletCredit';

const bodySchema = z.object({
  action: z.enum([
    'PAY_DRIVER',
    'NO_PAY_DRIVER',
    'REFUND_PARENT',
    'CREDIT_PARENT',
    'KEEP_REVENUE',
    'INCIDENT',
  ] as const),
  reason: z.string().min(3, 'Reason is required'),
  confirmAmountSar: z.number().positive().optional(),
});

function mapError(err: unknown) {
  if (err instanceof TripWalletCreditError) {
    const status =
      err.code === 'TRIP_NOT_FOUND' ? 404
      : err.code === 'ALREADY_CREDITED' || err.code === 'ALREADY_RESOLVED' ? 409
      : 400;
    return NextResponse.json({ data: null, error: { message: err.message, code: err.code } }, { status });
  }
  return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { action, reason, confirmAmountSar } = parsed.data;

    if (action === 'CREDIT_PARENT') {
      if (confirmAmountSar == null) {
        return NextResponse.json(
          { data: null, error: { message: 'confirmAmountSar is required for CREDIT_PARENT' } },
          { status: 400 },
        );
      }
      const result = await processTripWalletCredit({
        tripId: id,
        adminUserId: auth.userId,
        reason,
        confirmAmountSar,
      });
      return NextResponse.json({
        data: {
          trip: result.trip,
          walletCredit: {
            transactionId: result.walletTransaction.id,
            amountSar: result.walletTransaction.amountSar,
            newBalanceSar: result.walletTransaction.newBalanceSar,
            duplicate: result.duplicate,
            processed: true,
          },
        },
        error: null,
      });
    }

    const updated = await processNonCreditFinancialReview({
      tripId: id,
      adminUserId: auth.userId,
      action,
      reason,
    });

    return NextResponse.json({
      data: {
        trip: updated,
        walletCredit: action === 'REFUND_PARENT'
          ? { processed: false, manualPaymentActionRequired: true }
          : null,
      },
      error: null,
    });
  } catch (err) {
    return mapError(err);
  }
}
