import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function PATCH(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId } = auth;

    const { count } = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ data: { markedRead: count }, error: null });
  } catch (error) {
    console.error('[PATCH /api/notifications/read-all]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
