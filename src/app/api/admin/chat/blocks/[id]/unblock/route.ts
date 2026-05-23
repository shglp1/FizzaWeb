/**
 * PATCH /api/admin/chat/blocks/[id]/unblock
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { recordTripEventOnce } from '@/lib/trips/tripEvents';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const block = await prisma.chatBlock.findUnique({ where: { id } });
    if (!block) {
      return NextResponse.json({ data: null, error: { message: 'Block not found' } }, { status: 404 });
    }

    const updated = await prisma.chatBlock.update({
      where: { id },
      data: { active: false, endsAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'CHAT_UNBLOCK',
        details: JSON.stringify({ blockId: id, targetType: block.targetType }),
      },
    });

    await recordTripEventOnce('system', 'CHAT_UNBLOCKED', `Chat block lifted: ${block.targetType}`, {
      actorUserId: auth.userId,
      actorRole: 'ADMIN',
    }).catch(() => {});

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
