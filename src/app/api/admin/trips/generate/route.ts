import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { tripGenerateSchema } from '@/lib/validations/trip';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);
  while (current <= endNorm) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function parseTime(timeStr: string, baseDate: Date): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const parsed = tripGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : today;
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 6); // next 7 days
    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : defaultEnd;

    if (startDate > endDate) {
      return NextResponse.json(
        { data: null, error: { message: 'startDate must be before endDate' } },
        { status: 400 },
      );
    }

    // Limit to 31 days at a time for safety
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000);
    if (diffDays > 31) {
      return NextResponse.json(
        { data: null, error: { message: 'Date range cannot exceed 31 days' } },
        { status: 400 },
      );
    }

    // Fetch ACTIVE subscriptions with their schedules and rider
    const subscriptions = await prisma.userSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        schedules: { where: { isOffDay: false } },
      },
    });

    const dates = getDatesInRange(startDate, endDate);

    let generatedCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions) {
      const activeWeekdays = new Set(sub.schedules.map((s) => s.weekday));
      if (activeWeekdays.size === 0) continue;

      for (const date of dates) {
        const weekday = date.getDay(); // 0=Sun, 1=Mon... 6=Sat
        if (!activeWeekdays.has(weekday)) continue;

        try {
          // Idempotent check — skip if trip already exists for this subscription + date
          const existing = await prisma.trip.findFirst({
            where: {
              subscriptionId: sub.id,
              scheduledDate: date,
            },
            select: { id: true },
          });

          if (existing) continue;

          await prisma.trip.create({
            data: {
              subscriptionId: sub.id,
              riderId: sub.riderId ?? null,
              scheduledDate: date,
              scheduledPickupTime: parseTime(sub.pickupTime, date),
              scheduledDropoffTime: parseTime(sub.returnTime, date),
              pickupLocation: sub.pickupLocation,
              dropoffLocation: sub.dropoffLocation,
              status: 'SCHEDULED',
            },
          });

          generatedCount++;
        } catch {
          failedCount++;
        }
      }
    }

    // Record generation log
    await prisma.tripGenerationLog.create({
      data: {
        runDate: today,
        generatedCount,
        failedCount,
        notes: `Admin-triggered. Range: ${startDate.toISOString().slice(0, 10)} – ${endDate.toISOString().slice(0, 10)}. Subscriptions checked: ${subscriptions.length}.`,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'TRIPS_GENERATED',
        details: JSON.stringify({
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          generatedCount,
          failedCount,
        }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({
      data: { generatedCount, failedCount, startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10) },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
