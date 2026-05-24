import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { processPayrollPayout } from '@/lib/payroll/processPayrollPayout';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteParams) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const line = await prisma.driverPayrollLine.findUnique({
      where: { id },
      include: { driver: { select: { profileId: true } } },
    });

    if (!line) {
      return NextResponse.json(
        { data: null, error: { message: 'Payroll line not found' } },
        { status: 404 },
      );
    }

    if (line.status === 'PAID') {
      return NextResponse.json(
        { data: null, error: { message: 'Already marked as paid' } },
        { status: 400 },
      );
    }

    if (line.status !== 'APPROVED') {
      return NextResponse.json(
        { data: null, error: { message: 'Line must be approved before marking paid' } },
        { status: 400 },
      );
    }

    let payout;
    try {
      payout = await processPayrollPayout(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payout failed';
      return NextResponse.json({ data: null, error: { message } }, { status: 502 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.driverPayrollLine.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          payoutMethod: payout.method,
          payoutRef: payout.payoutRef,
          payoutError: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: payout.method === 'MYFATOORAH' ? 'PAYROLL_LINE_PAID_MYFATOORAH' : 'PAYROLL_LINE_PAID',
          details: JSON.stringify({
            lineId: id,
            netPaySar: Number(line.netPaySar),
            payoutMethod: payout.method,
            payoutRef: payout.payoutRef,
          }),
        },
      });

      if (line.driver.profileId) {
        await tx.notification.create({
          data: {
            userId: line.driver.profileId,
            title: payout.method === 'MYFATOORAH' ? 'Pay sent' : 'Payroll processed',
            message: payout.method === 'MYFATOORAH'
              ? `SAR ${Number(line.netPaySar).toFixed(2)} was transferred via MyFatoorah${payout.payoutRef ? ` (ref ${payout.payoutRef})` : ''}.`
              : `Your pay of SAR ${Number(line.netPaySar).toFixed(2)} has been marked as paid.`,
            type: 'SYSTEM',
          },
        });
      }

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
