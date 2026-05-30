/**
 * GET /api/admin/trips/[id]/financial-review/credit-preview
 * Preview wallet credit amount before CREDIT_PARENT confirmation.
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { TripWalletCreditError, previewTripWalletCredit } from '@/lib/financials/tripWalletCredit';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const preview = await previewTripWalletCredit(id);

    return NextResponse.json({ data: { preview }, error: null });
  } catch (err) {
    if (err instanceof TripWalletCreditError) {
      return NextResponse.json(
        { data: null, error: { message: err.message, code: err.code } },
        { status: err.code === 'TRIP_NOT_FOUND' ? 404 : 400 },
      );
    }
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
