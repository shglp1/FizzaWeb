import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { calculateTripEarning } from '@/lib/payroll/calculateTripEarning';
import { recalculatePayrollLine } from '@/lib/payroll/recalculatePayrollLine';
import { loadGlobalPayRules, resolveDriverPayRules } from '@/lib/payroll/payRules';

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  billableKm: z.number().min(0.1).max(500),
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

    const earning = await prisma.driverTripEarning.findUnique({
      where: { id },
      include: {
        payrollLine: true,
        driver: { include: { payProfile: true } },
      },
    });

    if (!earning) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip earning not found' } },
        { status: 404 },
      );
    }

    if (!earning.payrollLineId || !earning.payrollLine) {
      return NextResponse.json(
        { data: null, error: { message: 'Trip earning is not linked to a payroll line' } },
        { status: 400 },
      );
    }

    if (earning.payrollLine.status === 'PAID') {
      return NextResponse.json(
        { data: null, error: { message: 'Cannot edit trip earnings on a paid line' } },
        { status: 400 },
      );
    }

    const globalRules = await loadGlobalPayRules();
    const profile = earning.driver.payProfile;
    const rules = resolveDriverPayRules(globalRules, profile ? {
      ratePerKmSar: profile.ratePerKmSar != null ? Number(profile.ratePerKmSar) : null,
      platformFeePercent: profile.platformFeePercent != null ? Number(profile.platformFeePercent) : null,
    } : null);

    const amounts = calculateTripEarning({
      billableKm: parsed.data.billableKm,
      ratePerKmSar: Number(earning.ratePerKmSar) || rules.ratePerKmSar,
      platformFeePercent: Number(earning.platformFeePercent) || rules.platformFeePercent,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.driverTripEarning.update({
        where: { id },
        data: {
          billableKm: parsed.data.billableKm,
          kmSource: 'MANUAL',
          grossSar: amounts.grossSar,
          platformFeeSar: amounts.platformFeeSar,
          netSar: amounts.netSar,
        },
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
      });

      await tx.trip.update({
        where: { id: earning.tripId },
        data: { billableKmOverride: parsed.data.billableKm },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'PAYROLL_TRIP_KM_UPDATED',
          details: JSON.stringify({ earningId: id, billableKm: parsed.data.billableKm }),
        },
      });

      return row;
    });

    await recalculatePayrollLine(earning.payrollLineId!);

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
