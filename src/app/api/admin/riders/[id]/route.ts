import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(2).max(100).optional(),
  school: z.string().max(200).optional(),
  grade: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(
  req: Request,
  context: RouteContext<'/api/admin/riders/[id]'>,
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

    const existing = await prisma.rider.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Rider not found' } },
        { status: 404 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rider = await tx.rider.update({
        where: { id },
        data: parsed.data,
        select: { id: true, name: true, isActive: true, school: true, grade: true },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'ADMIN_RIDER_UPDATED',
          details: JSON.stringify({ riderId: id, changes: parsed.data }),
        },
      });

      return rider;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
