/**
 * PATCH /api/admin/chat/messages/[id]/moderate
 * Admin can set moderationStatus: CLEAN | FLAGGED | BLOCKED, or soft-delete.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const moderateSchema = z.object({
  moderationStatus: z.enum(['CLEAN', 'FLAGGED', 'BLOCKED']).optional(),
  delete: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 });
    }

    const parsed = moderateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, { status: 400 });
    }

    const { moderationStatus, delete: doDelete } = parsed.data;

    const message = await prisma.tripChatMessage.findUnique({ where: { id }, select: { id: true } });
    if (!message) {
      return NextResponse.json({ data: null, error: { message: 'Message not found' } }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (moderationStatus) update.moderationStatus = moderationStatus;
    if (doDelete) update.deletedAt = new Date();

    const updated = await prisma.tripChatMessage.update({
      where: { id },
      data: update,
      select: { id: true, moderationStatus: true, deletedAt: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'CHAT_MESSAGE_MODERATED',
        details: JSON.stringify({ messageId: id, moderationStatus, deleted: doDelete }),
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
