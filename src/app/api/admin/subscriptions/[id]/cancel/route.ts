import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { adminSubscriptionCancelSchema } from '@/lib/validations/subscription';
import {
  cancelNonTerminalTripsForSubscription,
  notifySubscriptionTripsCancelled,
} from '@/lib/subscriptions/subscriptionTripLifecycle';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  req: Request,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = adminSubscriptionCancelSchema.safeParse(body);
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
    if (sub.status === 'CANCELLED') {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription is already cancelled' } },
        { status: 409 },
      );
    }

    const tripReason = `Subscription cancelled by admin: ${parsed.data.reason.trim()}`;

    const { updated, tripsCancelled, driverProfileIds } = await prisma.$transaction(async (tx) => {
      const s = await tx.userSubscription.update({
        where: { id },
        data: { status: 'CANCELLED', cancellationReason: parsed.data.reason },
        select: { id: true, status: true, cancellationReason: true },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'ADMIN_SUBSCRIPTION_CANCELLED',
          details: JSON.stringify({ subscriptionId: id, reason: parsed.data.reason }),
        },
      });

      const cancelResult = await cancelNonTerminalTripsForSubscription(tx, {
        subscriptionId: id,
        reason: tripReason,
        cancelledByUserId: auth.userId,
        auditAction: 'SUBSCRIPTION_CANCEL_TRIPS_VOIDED',
        subscriptionStatus: 'CANCELLED',
      });

      await tx.notification.create({
        data: {
          userId: sub.userId,
          title: 'Subscription Cancelled',
          message: `Your subscription has been cancelled by an administrator. Reason: ${parsed.data.reason}`,
          type: 'SUBSCRIPTION',
        },
      });

      return {
        updated: s,
        tripsCancelled: cancelResult.cancelledCount,
        driverProfileIds: cancelResult.notifiedDriverProfileIds,
      };
    });

    if (tripsCancelled > 0) {
      await notifySubscriptionTripsCancelled({
        parentUserId: sub.userId,
        driverProfileIds,
        cancelledCount: tripsCancelled,
        reason: tripReason,
      });
    }

    return NextResponse.json({
      data: {
        ...updated,
        tripsCancelled,
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
