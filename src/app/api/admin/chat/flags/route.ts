/**
 * GET /api/admin/chat/flags
 * Returns flagged/blocked chat messages for admin moderation.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = 20;

    const [messages, total] = await Promise.all([
      prisma.tripChatMessage.findMany({
        where: { moderationStatus: { in: ['FLAGGED', 'BLOCKED'] }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, tripId: true, senderUserId: true, senderRole: true,
          body: true, moderationStatus: true, createdAt: true,
          trip: { select: { id: true, scheduledDate: true, rider: { select: { name: true } } } },
        },
      }),
      prisma.tripChatMessage.count({ where: { moderationStatus: { in: ['FLAGGED', 'BLOCKED'] }, deletedAt: null } }),
    ]);

    return NextResponse.json({
      data: { messages, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
