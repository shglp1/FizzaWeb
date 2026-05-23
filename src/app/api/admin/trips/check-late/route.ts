/**
 * POST /api/admin/trips/check-late
 * System/cron endpoint — detects driver-late trips and notifies once.
 * Run every 1–5 minutes in production (Vercel Cron / worker).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { getTripOpsConfig } from '@/lib/trips/tripConfig';
import { buildLateCandidate, LATE_CHECK_STATUSES } from '@/lib/trips/tripLateDetection';
import { notifyDriverLate } from '@/lib/trips/tripNotifications';

export async function POST(_req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const config = await getTripOpsConfig();
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const candidates = await prisma.trip.findMany({
      where: {
        scheduledDate: { gte: todayStart },
        status: { in: [...LATE_CHECK_STATUSES] },
        scheduledPickupTime: { not: null },
      },
      select: {
        id: true,
        status: true,
        scheduledPickupTime: true,
        subscription: { select: { userId: true } },
        rider: { select: { parentId: true } },
        driver: { select: { profileId: true } },
      },
    });

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    let processed = 0;

    for (const trip of candidates) {
      const late = buildLateCandidate(trip, now, config);
      if (!late) continue;

      await notifyDriverLate({
        tripId: trip.id,
        parentUserId: trip.subscription?.userId ?? trip.rider?.parentId ?? null,
        driverProfileId: trip.driver?.profileId ?? null,
        adminUserId: admin?.id ?? null,
      });
      processed++;
    }

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'LATE_CHECK_RUN',
        details: JSON.stringify({ checked: candidates.length, lateDetected: processed }),
      },
    });

    return NextResponse.json({
      data: { checked: candidates.length, lateDetected: processed },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
