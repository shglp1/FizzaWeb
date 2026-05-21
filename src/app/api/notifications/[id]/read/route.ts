import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId } = auth;
    const { id } = await context.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!notification || notification.userId !== userId) {
      return NextResponse.json({ data: null, error: { message: 'Notification not found' } }, { status: 404 });
    }

    await prisma.notification.update({ where: { id }, data: { isRead: true } });

    return NextResponse.json({ data: { id, isRead: true }, error: null });
  } catch (error) {
    console.error('[PATCH /api/notifications/[id]/read]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
