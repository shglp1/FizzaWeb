import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { subscriptionCreateSchema } from '@/lib/validations/subscription';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

const SUBSCRIPTION_SELECT = {
  id: true,
  userId: true,
  riderId: true,
  packageId: true,
  subscriptionType: true,
  pickupLocation: true,
  dropoffLocation: true,
  pickupTime: true,
  returnTime: true,
  femaleDriverPreference: true,
  autoRenewal: true,
  paymentStatus: true,
  status: true,
  startsOn: true,
  endsOn: true,
  createdAt: true,
  updatedAt: true,
  rider: { select: { id: true, name: true, relationship: true, school: true } },
  package: { select: { id: true, name: true, billingCycle: true, priceSar: true } },
  schedules: { select: { id: true, weekday: true, isOffDay: true } },
  addOns: {
    select: {
      id: true,
      addOnId: true,
      addOn: { select: { id: true, name: true, priceSar: true } },
    },
  },
} as const;

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const subscriptions = await prisma.userSubscription.findMany({
      where: { userId: auth.userId },
      select: SUBSCRIPTION_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: subscriptions, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = subscriptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const {
      packageId,
      riderId,
      subscriptionType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      returnTime,
      weekdays,
      offDays,
      addOnIds,
      femaleDriverPreference,
      autoRenewal,
      startsOn,
    } = parsed.data;

    // Verify rider ownership — rider must belong to this user
    if (riderId) {
      const rider = await prisma.rider.findFirst({
        where: { id: riderId, parentId: auth.userId, isActive: true },
      });
      if (!rider) {
        return NextResponse.json(
          { data: null, error: { message: 'Rider not found or does not belong to you' } },
          { status: 403 },
        );
      }
    }

    // Verify add-ons exist
    if (addOnIds && addOnIds.length > 0) {
      const foundAddOns = await prisma.addOn.findMany({
        where: { id: { in: addOnIds }, isActive: true },
        select: { id: true },
      });
      if (foundAddOns.length !== addOnIds.length) {
        return NextResponse.json(
          { data: null, error: { message: 'One or more add-ons are invalid' } },
          { status: 400 },
        );
      }
    }

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.userSubscription.create({
        data: {
          userId: auth.userId,
          riderId: riderId ?? null,
          packageId: packageId ?? null,
          subscriptionType,
          pickupLocation,
          dropoffLocation,
          pickupTime,
          returnTime,
          femaleDriverPreference: femaleDriverPreference ?? false,
          autoRenewal: autoRenewal ?? true,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          startsOn: startsOn ? new Date(startsOn) : null,
          schedules: {
            create: weekdays.map((day) => ({
              weekday: day,
              isOffDay: (offDays ?? []).includes(day),
            })),
          },
          addOns: addOnIds && addOnIds.length > 0
            ? { create: addOnIds.map((addOnId) => ({ addOnId })) }
            : undefined,
        },
        select: SUBSCRIPTION_SELECT,
      });

      await tx.notification.create({
        data: {
          userId: auth.userId,
          title: 'Subscription Created',
          message: `Your ${subscriptionType} subscription has been created and is pending payment.`,
          type: 'SUBSCRIPTION',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'SUBSCRIPTION_CREATED',
          details: JSON.stringify({
            subscriptionId: sub.id,
            subscriptionType,
            packageId,
            riderId,
          }),
          ipAddress: getIp(req),
        },
      });

      return sub;
    });

    return NextResponse.json({ data: subscription, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
