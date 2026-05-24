import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { adminSubscriptionUpdateSchema } from '@/lib/validations/subscription';
import { computeSubscriptionDaysLeft } from '@/lib/admin/subscriptionTimeline';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _req: Request,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const sub = await prisma.userSubscription.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
        rider: { select: { id: true, name: true, school: true, grade: true } },
        package: { select: { id: true, name: true, billingCycle: true, priceSar: true } },
        assignedDriver: {
          select: {
            id: true,
            profile: { select: { fullName: true, phone: true } },
            vehicle: { select: { model: true, plateNumber: true, color: true } },
          },
        },
        schedules: { select: { weekday: true, isOffDay: true } },
        addOns: { select: { addOn: { select: { id: true, name: true, priceSar: true } } } },
        subscriptionRiders: {
          select: {
            isPrimary: true,
            priceMultiplier: true,
            rider: { select: { id: true, name: true, school: true } },
          },
        },
        payments: { select: { id: true, amountSar: true, status: true, purpose: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        trips: {
          select: { id: true, status: true, scheduledDate: true, scheduledPickupTime: true },
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        },
        _count: { select: { trips: true } },
      },
    });

    if (!sub) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found' } },
        { status: 404 },
      );
    }

    const [completedTrips, totalTrips] = await Promise.all([
      prisma.trip.count({ where: { subscriptionId: id, status: 'COMPLETED' } }),
      prisma.trip.count({ where: { subscriptionId: id } }),
    ]);
    const daysLeft = computeSubscriptionDaysLeft(sub);

    return NextResponse.json({
      data: {
        ...sub,
        ridesUsed: completedTrips,
        daysLeft,
        _count: { trips: totalTrips },
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

export async function PATCH(
  req: Request,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = adminSubscriptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const sub = await prisma.userSubscription.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!sub) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found' } },
        { status: 404 },
      );
    }

    const { status, autoRenewal, startsOn, endsOn } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (autoRenewal !== undefined) updateData.autoRenewal = autoRenewal;
    if (startsOn !== undefined) updateData.startsOn = new Date(startsOn);
    if (endsOn !== undefined) updateData.endsOn = new Date(endsOn);

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.userSubscription.update({
        where: { id },
        data: updateData,
        select: { id: true, status: true, autoRenewal: true, startsOn: true, endsOn: true },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'ADMIN_SUBSCRIPTION_UPDATED',
          details: JSON.stringify({ subscriptionId: id, changes: updateData }),
        },
      });

      if (status && status !== sub.status) {
        await tx.notification.create({
          data: {
            userId: sub.userId,
            title: 'Subscription Updated',
            message: `Your subscription status has been updated to ${status}.`,
            type: 'SUBSCRIPTION',
          },
        });
      }

      return s;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
