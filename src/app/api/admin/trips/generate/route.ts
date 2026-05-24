import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { tripGenerateSchema } from '@/lib/validations/trip';
import { generateTrips } from '@/lib/dispatch/generateTrips';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const parsed = tripGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : today;
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 13);
    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : defaultEnd;

    const result = await generateTrips({
      startDate,
      endDate,
      triggeredBy: 'ADMIN',
      actorUserId: auth.userId,
    });

    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { data: null, error: { message } },
      { status: message.includes('Date range') ? 400 : 500 },
    );
  }
}
