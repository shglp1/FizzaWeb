/**
 * GET/POST /api/trips/[id]/rating
 * Parent service-day rating after trip completion.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { checkRatingEligibility, submitServiceDayRating } from '@/lib/ratings/ratingEligibility';
import { BusinessError, clientErrorMessage } from '@/lib/errors';

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const eligibility = await checkRatingEligibility(id, auth.userId);
    return NextResponse.json({ data: eligibility, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const parsed = ratingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const created = await submitServiceDayRating({
      tripId: id,
      parentId: auth.userId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });

    return NextResponse.json({ data: { rating: created }, error: null });
  } catch (err) {
    console.error('[POST /api/trips/[id]/rating]', err);
    const message = clientErrorMessage(err, 'Unable to submit rating');
    const status = err instanceof BusinessError ? err.status : 500;
    return NextResponse.json({ data: null, error: { message } }, { status });
  }
}
