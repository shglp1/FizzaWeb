import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildFinancialOverviewMetrics } from '@/lib/financials/financialOverviewMetrics';

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
      platformFeePaid,
      platformFeeApproved,
      platformFeeDraft,
      deductionsPaid,
      bonusesPaid,
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
      prisma.driverPayrollLine.aggregate({
        where: { status: 'PAID', ...(hasDateFilter ? { paidAt: dateFilter } : {}) },
        _sum: { platformFeeSar: true },
      }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'APPROVED' },
        _sum: { platformFeeSar: true },
      }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'DRAFT' },
        _sum: { platformFeeSar: true },
      }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'PAID', ...(hasDateFilter ? { paidAt: dateFilter } : {}) },
        _sum: { deductionsSar: true },
      }),
      prisma.driverPayrollLine.aggregate({
        where: { status: 'PAID', ...(hasDateFilter ? { paidAt: dateFilter } : {}) },
        _sum: { bonusesSar: true },
      }),
    ]);

    const parentRevenueSar = Number(paidPayments._sum.amountSar ?? 0);
    const driverPlatformFeePaidSar = Number(platformFeePaid._sum.platformFeeSar ?? 0);
    const driverDeductionsPaidSar = Number(deductionsPaid._sum.deductionsSar ?? 0);
    const driverBonusesPaidSar = Number(bonusesPaid._sum.bonusesSar ?? 0);
    const driverPayrollPaidSar = Number(payrollPaid._sum.netPaySar ?? 0);

    const metrics = buildFinancialOverviewMetrics({
      paidParentPaymentsSar: parentRevenueSar,
      pendingPaymentsSar: Number(pendingPayments._sum.amountSar ?? 0),
      failedPaymentsSar: Number(failedPayments._sum.amountSar ?? 0),
      driverPlatformFeePaidSar,
      driverDeductionsPaidSar,
      driverBonusesPaidSar,
      driverPayoutsCompletedSar: driverPayrollPaidSar,
    });

    return NextResponse.json({
      data: {
        totalRevenueSar: parentRevenueSar,
        paidParentRevenueSar: metrics.paidParentRevenueSar,
        paidPaymentsCount: paidPayments._count,
        pendingRevenueSar: metrics.pendingRevenueSar,
        pendingPaymentsCount: pendingPayments._count,
        failedPaymentsSar: metrics.failedPaymentsSar,
        failedPaymentsCount: failedPayments._count,
        walletTopUpRevenueSar: Number(walletTopUpsPaid._sum.amountSar ?? 0),
        walletTopUpsCount: walletTopUpsPaid._count,
        subscriptionRevenueSar: Number(subscriptionPaymentsPaid._sum.amountSar ?? 0),
        subscriptionPaymentsCount: subscriptionPaymentsPaid._count,
        totalWalletBalanceSar: Number(totalWalletBalance._sum.balanceSar ?? 0),
        driverPayrollPaidSar,
        driverPayrollPaidCount: payrollPaid._count,
        driverPayoutsCompletedSar: driverPayrollPaidSar,
        driverPayrollApprovedSar: Number(payrollApproved._sum.netPaySar ?? 0),
        driverPayrollApprovedCount: payrollApproved._count,
        driverPayrollDraftSar: Number(payrollPending._sum.netPaySar ?? 0),
        driverPayrollDraftCount: payrollPending._count,
        driverPlatformFeePaidSar,
        driverPlatformFeeApprovedSar: Number(platformFeeApproved._sum.platformFeeSar ?? 0),
        driverPlatformFeeDraftSar: Number(platformFeeDraft._sum.platformFeeSar ?? 0),
        driverDeductionsPaidSar,
        driverBonusesPaidSar,
        driverRetentionPaidSar: metrics.driverRetentionPaidSar,
        totalPlatformRevenueSar: metrics.totalRecognizedRevenueSar,
        totalRecognizedRevenueSar: metrics.totalRecognizedRevenueSar,
        estimatedGrossMarginSar: metrics.estimatedGrossMarginSar,
        estimatedGrossMarginPercent: metrics.estimatedGrossMarginPercent,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      error: null,
    }, {
      headers: {
        // Admin KPI dashboard: brief private cache to avoid re-running ~14 heavy
        // aggregates on every tab switch / re-render. Per-URL (date filters keyed
        // in the query string). Private + short TTL so reported figures stay fresh;
        // never cached by shared CDNs. Financial mutations are not cached here —
        // this is a read-only reporting view.
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
