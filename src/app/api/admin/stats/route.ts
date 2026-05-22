import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [
      totalUsers,
      totalRiders,
      totalDrivers,
      pendingApplications,
      activeSubscriptions,
      pendingSubscriptions,
      todayTrips,
      activeTrips,
      completedTodayTrips,
      pendingPayments,
      revenueResult,
      pendingSafetyReports,
    ] = await Promise.all([
      prisma.profile.count({ where: { role: { not: 'ADMIN' } } }),
      prisma.rider.count({ where: { isActive: true } }),
      prisma.driver.count({ where: { isSuspended: false } }),
      prisma.driverApplication.count({ where: { status: 'PENDING' } }),
      prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.userSubscription.count({ where: { status: 'PENDING' } }),
      prisma.trip.count({
        where: { scheduledDate: { gte: today, lt: tomorrow } },
      }),
      prisma.trip.count({
        where: {
          status: { in: ['DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP'] },
        },
      }),
      prisma.trip.count({
        where: {
          status: 'COMPLETED',
          scheduledDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amountSar: true },
      }),
      prisma.safetyReport.count({ where: { status: 'PENDING' } }),
    ]);

    return NextResponse.json({
      data: {
        totalUsers,
        totalRiders,
        totalDrivers,
        pendingApplications,
        activeSubscriptions,
        pendingSubscriptions,
        todayTrips,
        activeTrips,
        completedTodayTrips,
        pendingPayments,
        totalRevenueSar: Number(revenueResult._sum.amountSar ?? 0),
        pendingSafetyReports,
        lastUpdated: new Date().toISOString(),
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
