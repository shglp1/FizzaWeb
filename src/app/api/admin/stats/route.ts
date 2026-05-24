import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildLateCandidate, LATE_CHECK_STATUSES } from '@/lib/trips/tripLateDetection';
import { getTripOpsConfig } from '@/lib/trips/tripConfig';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const config = await getTripOpsConfig();
    const now = Date.now();

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
      failedPayments,
      revenueResult,
      pendingSafetyReports,
      chatFlags,
      unassignedTripsToday,
      lateCandidates,
      recentActivity,
    ] = await Promise.all([
      prisma.profile.count({ where: { role: { not: 'ADMIN' } } }),
      prisma.rider.count({ where: { isActive: true } }),
      prisma.driver.count({ where: { isSuspended: false } }),
      prisma.driverApplication.count({ where: { status: 'PENDING' } }),
      prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.userSubscription.count({ where: { status: 'PENDING' } }),
      prisma.trip.count({ where: { scheduledDate: { gte: today, lt: tomorrow } } }),
      prisma.trip.count({
        where: {
          status: { in: ['DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'PRE_TRIP', 'ARRIVED_PICKUP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'] },
        },
      }),
      prisma.trip.count({
        where: { status: 'COMPLETED', scheduledDate: { gte: today, lt: tomorrow } },
      }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'FAILED' } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amountSar: true } }),
      prisma.safetyReport.count({ where: { status: 'PENDING' } }),
      prisma.tripChatMessage.count({ where: { moderationStatus: { in: ['FLAGGED', 'BLOCKED'] } } }),
      prisma.trip.count({
        where: {
          scheduledDate: { gte: today, lt: tomorrow },
          status: 'SCHEDULED',
          driverId: null,
        },
      }),
      prisma.trip.findMany({
        where: {
          scheduledDate: { gte: today },
          status: { in: [...LATE_CHECK_STATUSES] },
          scheduledPickupTime: { not: null },
        },
        select: {
          id: true,
          status: true,
          scheduledPickupTime: true,
          rider: { select: { name: true } },
          driver: { select: { profile: { select: { fullName: true } } } },
        },
        take: 100,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      }),
    ]);

    const delayedTrips = lateCandidates.filter((trip) =>
      buildLateCandidate(trip, now, config) !== null,
    ).length;

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
        failedPayments,
        totalRevenueSar: Number(revenueResult._sum.amountSar ?? 0),
        pendingSafetyReports,
        chatFlags,
        unassignedTripsToday,
        delayedTrips,
        needsAttention: {
          unassignedTrips: unassignedTripsToday,
          delayedTrips,
          pendingApplications,
          pendingPayments,
          failedPayments,
          openSafetyReports: pendingSafetyReports,
        },
        todayOperations: {
          total: todayTrips,
          active: activeTrips,
          completed: completedTodayTrips,
          unassigned: unassignedTripsToday,
          delayed: delayedTrips,
        },
        recentActivity,
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
