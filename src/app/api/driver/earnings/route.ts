import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { loadGlobalPayRules } from '@/lib/payroll/payRules';
import { isTripPayrollEligible } from '@/lib/trips/tripClassification';
import { toClassifiableTrip } from '@/lib/trips/tripApiFilters';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['DRIVER', 'ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    let driverId: string | null = null;

    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (!driver) {
        return NextResponse.json({ data: { rules: null, periods: [], currentPeriod: null }, error: null });
      }
      driverId = driver.id;
    } else {
      return NextResponse.json(
        { data: null, error: { message: 'Use admin payroll APIs' } },
        { status: 403 },
      );
    }

    const globalRules = await loadGlobalPayRules();
    const payProfile = await prisma.driverPayProfile.findUnique({ where: { driverId } });

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getUTCFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getUTCMonth() + 1;

    const payrollLine = await prisma.driverPayrollLine.findFirst({
      where: {
        driverId,
        payrollRun: { year, month },
      },
      include: {
        payrollRun: true,
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
          orderBy: { tripCompletedAt: 'asc' },
        },
      },
    });

    const recentLines = await prisma.driverPayrollLine.findMany({
      where: { driverId },
      include: { payrollRun: { select: { year: true, month: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const ytdLines = await prisma.driverPayrollLine.findMany({
      where: {
        driverId,
        status: { in: ['APPROVED', 'PAID'] },
        createdAt: { gte: ytdStart },
      },
    });

    const ytdNetPaySar = ytdLines.reduce((s, l) => s + Number(l.netPaySar), 0);
    const ytdTrips = ytdLines.reduce((s, l) => s + l.tripCount, 0);

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const completedInPeriod = await prisma.trip.findMany({
      where: {
        driverId: driverId!,
        status: 'COMPLETED',
        scheduledDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        scheduledPickupTime: true,
        financialReviewStatus: true,
        pickupLocation: true,
        dropoffLocation: true,
        legType: true,
      },
    });
    const heldTrips = completedInPeriod
      .filter((t) => !isTripPayrollEligible(toClassifiableTrip(t)))
      .map((t) => ({
        tripId: t.id,
        scheduledDate: t.scheduledDate,
        pickupLocation: t.pickupLocation,
        dropoffLocation: t.dropoffLocation,
        legType: t.legType,
        financialReviewStatus: t.financialReviewStatus,
        reason: t.financialReviewStatus === 'PENDING'
          ? 'Under financial review'
          : 'Held from payroll — see admin resolution',
      }));

    return NextResponse.json({
      data: {
        rules: {
          global: globalRules,
          overrides: payProfile ? {
            ratePerKmSar: payProfile.ratePerKmSar != null ? Number(payProfile.ratePerKmSar) : null,
            platformFeePercent: payProfile.platformFeePercent != null ? Number(payProfile.platformFeePercent) : null,
          } : null,
        },
        currentPeriod: payrollLine ? {
          year,
          month,
          status: payrollLine.status,
          tripCount: payrollLine.tripCount,
          totalBillableKm: Number(payrollLine.totalBillableKm),
          grossSar: Number(payrollLine.grossSar),
          platformFeeSar: Number(payrollLine.platformFeeSar),
          tripNetSar: Number(payrollLine.tripNetSar),
          deductionsSar: Number(payrollLine.deductionsSar),
          bonusesSar: Number(payrollLine.bonusesSar),
          netPaySar: Number(payrollLine.netPaySar),
          paidAt: payrollLine.paidAt,
          trips: payrollLine.tripEarnings.map((e) => ({
            tripId: e.tripId,
            scheduledDate: e.trip.scheduledDate,
            pickupLocation: e.trip.pickupLocation,
            dropoffLocation: e.trip.dropoffLocation,
            legType: e.trip.legType,
            billableKm: Number(e.billableKm),
            kmSource: e.kmSource,
            grossSar: Number(e.grossSar),
            platformFeeSar: Number(e.platformFeeSar),
            netSar: Number(e.netSar),
          })),
        } : null,
        recentPeriods: recentLines.map((l) => ({
          year: l.payrollRun.year,
          month: l.payrollRun.month,
          status: l.status,
          netPaySar: Number(l.netPaySar),
          tripCount: l.tripCount,
          paidAt: l.paidAt,
        })),
        ytd: { netPaySar: ytdNetPaySar, tripCount: ytdTrips },
        heldTrips,
      },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
