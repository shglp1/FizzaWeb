import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

const updateSchema = z.object({
  availability: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspensionReason: z.string().min(5).max(1000).optional(),
}).refine(
  (d) => {
    if (d.isSuspended === true && !d.suspensionReason?.trim()) return false;
    return true;
  },
  { message: 'Suspension reason is required when suspending a driver', path: ['suspensionReason'] },
);

export async function PATCH(
  req: Request,
  context: RouteContext<'/api/admin/drivers/[id]'>,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { id },
      select: { id: true, profileId: true, isSuspended: true },
    });
    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver not found' } },
        { status: 404 },
      );
    }

    const { availability, isSuspended, suspensionReason } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (availability !== undefined) updateData.availability = availability;
    if (isSuspended !== undefined) {
      updateData.isSuspended = isSuspended;
      updateData.suspensionReason = isSuspended ? suspensionReason : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.driver.update({
        where: { id },
        data: updateData,
        select: { id: true, availability: true, isSuspended: true, suspensionReason: true },
      });

      const action = isSuspended === true
        ? 'DRIVER_SUSPENDED'
        : isSuspended === false
        ? 'DRIVER_UNSUSPENDED'
        : 'DRIVER_UPDATED';

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action,
          details: JSON.stringify({ driverId: id, changes: updateData }),
        },
      });

      // Notify driver of suspension/unsuspension
      if (driver.profileId && isSuspended !== undefined) {
        await tx.notification.create({
          data: {
            userId: driver.profileId,
            title: isSuspended ? 'Account Suspended' : 'Account Reinstated',
            message: isSuspended
              ? `Your driver account has been suspended. Reason: ${suspensionReason}`
              : 'Your driver account has been reinstated. You can now accept trips.',
            type: 'SYSTEM',
          },
        });
      }

      return d;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
