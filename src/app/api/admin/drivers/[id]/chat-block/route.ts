/**
 * PATCH /api/admin/drivers/[id]/chat-block
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import { recordTripEventOnce } from '@/lib/trips/tripEvents';

const blockSchema = z.object({
  reason: z.string().min(3).max(500),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional().default(true),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id: driverId } = await params;
    const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { id: true } });
    if (!driver) {
      return NextResponse.json({ data: null, error: { message: 'Driver not found' } }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 });
    }
    const parsed = blockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, { status: 400 });
    }

    const { reason, endsAt, active } = parsed.data;

    const block = await prisma.chatBlock.create({
      data: {
        driverId,
        targetType: 'DRIVER',
        reason,
        blockedByAdminId: auth.userId,
        endsAt: endsAt ? new Date(endsAt) : null,
        active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'DRIVER_CHAT_BLOCKED',
        details: JSON.stringify({ driverId, reason, blockId: block.id }),
      },
    });

    await recordTripEventOnce('system', 'CHAT_DRIVER_BLOCKED', `Driver chat blocked: ${reason}`, {
      actorUserId: auth.userId,
      actorRole: 'ADMIN',
      metadata: { driverId, blockId: block.id },
    }).catch(() => {});

    return NextResponse.json({ data: block, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
