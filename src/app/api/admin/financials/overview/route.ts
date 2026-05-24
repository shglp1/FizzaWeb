import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';

    const dateFilter: Record<string, unknown> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59Z');
    const hasDateFilter = dateFrom || dateTo;

    const paymentWhere = hasDateFilter ? { createdAt: dateFilter } : {};

    const [
      paidPayments,
      pendingPayments,
      failedPayments,
      walletTopUpsPaid,
      subscriptionPaymentsPaid,
      totalWalletBalance,
      payrollPaid,
      payrollApproved,
      payrollPending,
    ] = await Promise.all([
      prisma.payment.aggregate({ where: { status: 'PAID', ...paymentWhere }, _sum: { amountSar: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: 'PENDING', ...paymentWhere }, _sum: { amountSar: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: 'FAILED', ...paymentWhere }, _sum: { amountSar: true }, _count: true }),
      prisma.payment.aggregate({
        where: { status: 'PAID', purpose: 'WALLET_TOP_UP', ...paymentWhere },
        _sum: { amountSar: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: 'PAID', purpose: 'SUBSCRIPTION_PAYMENT', ...paymentWhere },
        _sum: { amountSar: true },
        _count: true,
      }),
      prisma.wallet.aggregate({ _sum: { balanceSar: true } }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'PAID', ...(hasDateFilter ? { paidAt: dateFilter } : {}) },
        _sum: { netPaySar: true },
        _count: true,
      }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'APPROVED' },
        _sum: { netPaySar: true },
        _count: true,
      }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'DRAFT' },
        _sum: { netPaySar: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      data: {
        totalRevenueSar: Number(paidPayments._sum.amountSar ?? 0),
        paidPaymentsCount: paidPayments._count,
        pendingRevenueSar: Number(pendingPayments._sum.amountSar ?? 0),
        pendingPaymentsCount: pendingPayments._count,
        failedPaymentsSar: Number(failedPayments._sum.amountSar ?? 0),
        failedPaymentsCount: failedPayments._count,
        walletTopUpRevenueSar: Number(walletTopUpsPaid._sum.amountSar ?? 0),
        walletTopUpsCount: walletTopUpsPaid._count,
        subscriptionRevenueSar: Number(subscriptionPaymentsPaid._sum.amountSar ?? 0),
        subscriptionPaymentsCount: subscriptionPaymentsPaid._count,
        totalWalletBalanceSar: Number(totalWalletBalance._sum.balanceSar ?? 0),
        driverPayrollPaidSar: Number(payrollPaid._sum.netPaySar ?? 0),
        driverPayrollPaidCount: payrollPaid._count,
        driverPayrollApprovedSar: Number(payrollApproved._sum.netPaySar ?? 0),
        driverPayrollApprovedCount: payrollApproved._count,
        driverPayrollDraftSar: Number(payrollPending._sum.netPaySar ?? 0),
        driverPayrollDraftCount: payrollPending._count,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
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
