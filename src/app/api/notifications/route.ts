import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { notificationListQuerySchema } from '@/lib/validations/notification';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId } = auth;

    const raw = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = notificationListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      );
    }

    const { page, limit, unreadOnly, type } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return NextResponse.json({
      data: {
        notifications,
        unreadCount,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/notifications]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
