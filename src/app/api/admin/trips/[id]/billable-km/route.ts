import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  billableKmOverride: z.number().min(0.1).max(500).nullable(),
});

export async function PATCH(req: Request, context: RouteParams) {
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

    const trip = await prisma.trip.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip not found' } },
        { status: 404 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.trip.update({
        where: { id },
        data: { billableKmOverride: parsed.data.billableKmOverride },
        select: {
          id: true,
          billableKmOverride: true,
          scheduledDate: true,
          pickupLocation: true,
          dropoffLocation: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'TRIP_BILLABLE_KM_OVERRIDE',
          details: JSON.stringify({ tripId: id, billableKmOverride: parsed.data.billableKmOverride }),
        },
      });

      return row;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
