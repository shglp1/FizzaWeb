import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { calculatePeriodNetPay } from '@/lib/payroll/calculateTripEarning';

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  deductionsSar: z.number().min(0).optional(),
  bonusesSar: z.number().min(0).optional(),
  adminNotes: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'APPROVED']).optional(),
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

    const line = await prisma.driverPayrollLine.findUnique({ where: { id } });
    if (!line) {
      return NextResponse.json(
        { data: null, error: { message: 'Payroll line not found' } },
        { status: 404 },
      );
    }

    if (line.status === 'PAID') {
      return NextResponse.json(
        { data: null, error: { message: 'Paid lines cannot be edited' } },
        { status: 400 },
      );
    }

    const deductionsSar = parsed.data.deductionsSar ?? Number(line.deductionsSar);
    const bonusesSar = parsed.data.bonusesSar ?? Number(line.bonusesSar);
    const tripNetSar = Number(line.tripNetSar);
    const netPaySar = calculatePeriodNetPay({ tripNetSar, deductionsSar, bonusesSar });

    const updateData: Record<string, unknown> = {
      deductionsSar,
      bonusesSar,
      netPaySar,
    };
    if (parsed.data.adminNotes !== undefined) updateData.adminNotes = parsed.data.adminNotes;

    const finalNotes = parsed.data.adminNotes ?? line.adminNotes ?? '';
    if (deductionsSar > 0 && !finalNotes.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Admin notes are required when applying deductions' } },
        { status: 400 },
      );
    }

    if (parsed.data.status === 'APPROVED') {
      updateData.status = 'APPROVED';
      updateData.approvedAt = new Date();
      updateData.approvedById = auth.userId;
    } else if (parsed.data.status === 'DRAFT') {
      updateData.status = 'DRAFT';
      updateData.approvedAt = null;
      updateData.approvedById = null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.driverPayrollLine.update({
        where: { id },
        data: updateData,
        include: {
          driver: {
            include: { profile: { include: { user: { select: { email: true } } } } },
          },
          tripEarnings: {
            include: {
              trip: {
                select: {
                  id: true,
                  scheduledDate: true,
                  pickupLocation: true,
                  dropoffLocation: true,
                  legType: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: parsed.data.status === 'APPROVED' ? 'PAYROLL_LINE_APPROVED' : 'PAYROLL_LINE_UPDATED',
          details: JSON.stringify({ lineId: id, changes: parsed.data }),
        },
      });

      return result;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
