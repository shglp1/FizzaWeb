import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { payrollLinesToCsv } from '@/lib/payroll/payrollExport';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') ?? '', 10);
    const month = parseInt(searchParams.get('month') ?? '', 10);

    if (!year || !month) {
      return NextResponse.json(
        { data: null, error: { message: 'year and month are required' } },
        { status: 400 },
      );
    }

    const run = await prisma.payrollRun.findUnique({
      where: { year_month: { year, month } },
      include: {
        lines: {
          include: {
            driver: {
              include: {
                profile: { include: { user: { select: { email: true } } } },
              },
            },
          },
          orderBy: { netPaySar: 'desc' },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { data: null, error: { message: 'Payroll run not found' } },
        { status: 404 },
      );
    }

    const csv = payrollLinesToCsv(
      run.lines.map((line) => ({
        driverName: line.driver.profile?.fullName ?? 'Driver',
        driverEmail: line.driver.profile?.user.email ?? '',
        tripCount: line.tripCount,
        totalBillableKm: Number(line.totalBillableKm),
        grossSar: Number(line.grossSar),
        platformFeeSar: Number(line.platformFeeSar),
        tripNetSar: Number(line.tripNetSar),
        deductionsSar: Number(line.deductionsSar),
        bonusesSar: Number(line.bonusesSar),
        netPaySar: Number(line.netPaySar),
        status: line.status,
        payoutMethod: line.payoutMethod,
        payoutRef: line.payoutRef,
        paidAt: line.paidAt,
      })),
    );

    const filename = `fizza-payroll-${year}-${String(month).padStart(2, '0')}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
