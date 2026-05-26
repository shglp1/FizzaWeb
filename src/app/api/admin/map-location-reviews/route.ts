import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { listPendingLocationReviews } from '@/lib/maps/locationReview';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '20');
    const status = searchParams.get('status') ?? 'PENDING';

    if (status !== 'PENDING') {
      const { prisma } = await import('@/lib/prisma');
      const take = Math.min(50, Math.max(1, limit));
      const skip = (Math.max(1, page) - 1) * take;
      const [items, total] = await Promise.all([
        prisma.mapLocationReview.findMany({
          where: { status: status as never },
          orderBy: { updatedAt: 'desc' },
          skip,
          take,
        }),
        prisma.mapLocationReview.count({ where: { status: status as never } }),
      ]);
      return NextResponse.json({ data: { items, total, page, limit: take }, error: null });
    }

    const data = await listPendingLocationReviews(page, limit);
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
