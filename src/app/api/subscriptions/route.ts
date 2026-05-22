import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { subscriptionCreateSchema } from '@/lib/validations/subscription';
import { getPricingConfig, calculateSubscriptionQuote } from '@/lib/pricing/subscriptionPricing';

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
  estimatedDistanceKm: true,
  packagePriceSar: true,
  addOnsPriceSar: true,
  distancePriceSar: true,
  extraRidersPriceSar: true,
  finalPriceSar: true,
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
  subscriptionRiders: {
    select: {
      id: true,
      riderId: true,
      isPrimary: true,
      priceMultiplier: true,
      rider: { select: { id: true, name: true, relationship: true } },
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
      riderIds,
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
      estimatedDistanceKm,
    } = parsed.data;

    // Resolve which rider IDs to use: prefer riderIds array, fall back to single riderId
    const resolvedRiderIds: string[] = riderIds && riderIds.length > 0
      ? riderIds
      : riderId ? [riderId] : [];

    // Validate all rider ownerships
    if (resolvedRiderIds.length > 0) {
      const riders = await prisma.rider.findMany({
        where: { id: { in: resolvedRiderIds }, parentId: auth.userId, isActive: true },
        select: { id: true },
      });
      if (riders.length !== resolvedRiderIds.length) {
        return NextResponse.json(
          { data: null, error: { message: 'One or more riders not found or do not belong to you' } },
          { status: 403 },
        );
      }
    }

    // Verify add-ons exist
    let addOnsPriceSar = 0;
    if (addOnIds && addOnIds.length > 0) {
      const foundAddOns = await prisma.addOn.findMany({
        where: { id: { in: addOnIds }, isActive: true },
        select: { id: true, priceSar: true },
      });
      if (foundAddOns.length !== addOnIds.length) {
        return NextResponse.json(
          { data: null, error: { message: 'One or more add-ons are invalid' } },
          { status: 400 },
        );
      }
      addOnsPriceSar = foundAddOns.reduce((sum, a) => sum + Number(a.priceSar), 0);
    }

    // Fetch package price server-side
    let packagePriceSar = 0;
    if (packageId) {
      const pkg = await prisma.subscriptionPackage.findFirst({
        where: { id: packageId, isActive: true },
        select: { priceSar: true },
      });
      if (!pkg) {
        return NextResponse.json(
          { data: null, error: { message: 'Package not found' } },
          { status: 404 },
        );
      }
      packagePriceSar = Number(pkg.priceSar);
    }

    // Calculate pricing server-side
    const config = await getPricingConfig();
    const extraRiderCount = Math.max(0, resolvedRiderIds.length - 1);
    const pricing = calculateSubscriptionQuote(
      packagePriceSar,
      addOnsPriceSar,
      estimatedDistanceKm ?? 0,
      extraRiderCount,
      config,
    );

    // Primary rider = first in list (for backward compat riderId field)
    const primaryRiderId = resolvedRiderIds[0] ?? null;

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.userSubscription.create({
        data: {
          userId: auth.userId,
          riderId: primaryRiderId,
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
          estimatedDistanceKm: estimatedDistanceKm ?? null,
          packagePriceSar: pricing.packagePriceSar,
          addOnsPriceSar: pricing.addOnsPriceSar,
          distancePriceSar: pricing.distancePriceSar,
          extraRidersPriceSar: pricing.extraRidersPriceSar,
          finalPriceSar: pricing.finalPriceSar,
          schedules: {
            create: weekdays.map((day) => ({
              weekday: day,
              isOffDay: (offDays ?? []).includes(day),
            })),
          },
          addOns: addOnIds && addOnIds.length > 0
            ? { create: addOnIds.map((addOnId) => ({ addOnId })) }
            : undefined,
          subscriptionRiders: resolvedRiderIds.length > 0
            ? {
                create: resolvedRiderIds.map((rid, idx) => ({
                  riderId: rid,
                  isPrimary: idx === 0,
                  priceMultiplier: idx === 0 ? 1.0 : config.extraRiderSameDropoffMultiplier,
                })),
              }
            : undefined,
        },
        select: SUBSCRIPTION_SELECT,
      });

      await tx.notification.create({
        data: {
          userId: auth.userId,
          title: 'Subscription Created',
          message: `Your ${subscriptionType} subscription has been created and is pending payment. Final price: SAR ${pricing.finalPriceSar.toFixed(2)}.`,
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
            riderIds: resolvedRiderIds,
            pricing,
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
