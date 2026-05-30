import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { subscriptionUpdateSchema } from '@/lib/validations/subscription';
import {
  cancelNonTerminalTripsForSubscription,
  notifySubscriptionTripsCancelled,
} from '@/lib/subscriptions/subscriptionTripLifecycle';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const existing = await prisma.userSubscription.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found or permission denied' } },
        { status: 403 },
      );
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { data: null, error: { message: 'Cannot update a cancelled subscription' } },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = subscriptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { startsOn, ...rest } = parsed.data;
    const data = {
      ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
      ...(startsOn ? { startsOn: new Date(startsOn) } : {}),
    };

    const subscription = await prisma.userSubscription.update({
      where: { id },
      data,
      include: {
        rider: { select: { id: true, name: true, relationship: true } },
        package: { select: { id: true, name: true, billingCycle: true, priceSar: true } },
        schedules: true,
        addOns: { include: { addOn: { select: { id: true, name: true, priceSar: true } } } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'SUBSCRIPTION_UPDATED',
        details: JSON.stringify({ subscriptionId: id, updatedFields: Object.keys(data) }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({ data: subscription, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const existing = await prisma.userSubscription.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found or permission denied' } },
        { status: 403 },
      );
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription is already cancelled' } },
        { status: 400 },
      );
    }

    const tripReason = 'Subscription cancelled by parent — future trips voided';

    const { subscription, tripsCancelled, driverProfileIds } = await prisma.$transaction(async (tx) => {
      const sub = await tx.userSubscription.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      await tx.notification.create({
        data: {
          userId: auth.userId,
          title: 'Subscription Cancelled',
          message: `Your ${existing.subscriptionType} subscription has been cancelled.`,
          type: 'SUBSCRIPTION',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'SUBSCRIPTION_CANCELLED',
          details: JSON.stringify({ subscriptionId: id }),
          ipAddress: getIp(req),
        },
      });

      const cancelResult = await cancelNonTerminalTripsForSubscription(tx, {
        subscriptionId: id,
        reason: tripReason,
        cancelledByUserId: auth.userId,
        auditAction: 'SUBSCRIPTION_CANCEL_TRIPS_VOIDED',
        subscriptionStatus: 'CANCELLED',
      });

      return {
        subscription: sub,
        tripsCancelled: cancelResult.cancelledCount,
        driverProfileIds: cancelResult.notifiedDriverProfileIds,
      };
    });

    if (tripsCancelled > 0) {
      await notifySubscriptionTripsCancelled({
        parentUserId: auth.userId,
        driverProfileIds,
        cancelledCount: tripsCancelled,
        reason: tripReason,
      });
    }

    return NextResponse.json({ data: { ...subscription, tripsCancelled }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
