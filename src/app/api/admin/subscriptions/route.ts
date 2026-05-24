import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { subscriptionCreateSchema } from '@/lib/validations/subscription';
import { getPricingConfig, calculateSubscriptionQuote } from '@/lib/pricing/subscriptionPricing';
import {
  calculateRouteDistanceKm,
  calculateRouteDistanceKmFromCoords,
  calculateChargeableDistanceKm,
  DistanceError,
} from '@/lib/maps/distance';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/pagination';
import { z } from 'zod';

/** Normalise a location that may be a plain string or a coordinate object. */
function resolveLocationInput(
  loc: string | { label: string; latitude: number; longitude: number },
): { label: string; lat: number | null; lng: number | null; hasCoords: boolean } {
  if (typeof loc === 'string') {
    return { label: loc, lat: null, lng: null, hasCoords: false };
  }
  return { label: loc.label, lat: loc.latitude, lng: loc.longitude, hasCoords: true };
}

/** Admin-only fields added on top of the regular create schema. */
const adminSubscriptionCreateSchema = subscriptionCreateSchema.extend({
  /** The parent user the subscription is being created for. */
  userId: z.string().uuid('userId must be a valid UUID'),
  /** Optional explicit end date (YYYY-MM-DD). */
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endsOn must be YYYY-MM-DD').optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    const paymentStatus = searchParams.get('paymentStatus') ?? '';
    const packageId = searchParams.get('packageId') ?? '';
    const userId = searchParams.get('userId') ?? '';
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';
    const search = searchParams.get('search') ?? '';
    const assignedDriverId = searchParams.get('assignedDriverId') ?? '';
    const unassigned = searchParams.get('unassigned') === 'true';
    const assigned = searchParams.get('assigned') === 'true';
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (packageId) where.packageId = packageId;
    if (userId) where.userId = userId;
    if (assignedDriverId) where.assignedDriverId = assignedDriverId;
    if (unassigned) where.assignedDriverId = null;
    if (assigned) where.assignedDriverId = { not: null };
    if (search) {
      where.OR = [
        { user: { fullName: { contains: search } } },
        { user: { user: { email: { contains: search } } } },
        { rider: { name: { contains: search } } },
        { pickupLocation: { contains: search } },
        { dropoffLocation: { contains: search } },
        { normalizedPickupLabel: { contains: search } },
        { normalizedDropoffLabel: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59Z');
    }

    const today = new Date();

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where,
        select: {
          id: true,
          subscriptionType: true,
          status: true,
          paymentStatus: true,
          autoRenewal: true,
          startsOn: true,
          endsOn: true,
          pickupLocation: true,
          dropoffLocation: true,
          normalizedPickupLabel: true,
          normalizedDropoffLabel: true,
          tripDirection: true,
          pickupTime: true,
          returnTime: true,
          actualServiceDays: true,
          finalPriceSar: true,
          packagePriceSar: true,
          addOnsPriceSar: true,
          distancePriceSar: true,
          extraRidersPriceSar: true,
          estimatedDistanceKm: true,
          cancellationReason: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
          rider: { select: { id: true, name: true, school: true } },
          package: { select: { id: true, name: true, billingCycle: true } },
          addOns: { select: { addOn: { select: { id: true, name: true } } } },
          subscriptionRiders: { select: { rider: { select: { id: true, name: true } }, isPrimary: true } },
          assignedDriverId: true,
          assignedDriver: { select: { id: true, profile: { select: { fullName: true, phone: true } }, vehicle: { select: { model: true, plateNumber: true } } } },
          schedules: { select: { weekday: true, isOffDay: true } },
          _count: { select: { trips: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userSubscription.count({ where }),
    ]);

    // Calculate rides used/remaining + days left from DB aggregation
    const subsWithUsage = await Promise.all(
      subscriptions.map(async (sub) => {
        const completedTrips = await prisma.trip.count({
          where: { subscriptionId: sub.id, status: 'COMPLETED' },
        });
        const daysLeft = sub.endsOn
          ? Math.max(0, Math.ceil((sub.endsOn.getTime() - today.getTime()) / 86_400_000))
          : null;
        return { ...sub, ridesUsed: completedTrips, daysLeft };
      }),
    );

    return NextResponse.json({
      data: {
        subscriptions: subsWithUsage,
        meta: buildPaginationMeta(page, limit, total),
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

// ── Admin-created subscription ────────────────────────────────────────────────

const ADMIN_SUB_SELECT = {
  id: true,
  userId: true,
  riderId: true,
  packageId: true,
  subscriptionType: true,
  pickupLocation: true,
  dropoffLocation: true,
  tripDirection: true,
  pickupTime: true,
  returnTime: true,
  femaleDriverPreference: true,
  autoRenewal: true,
  paymentStatus: true,
  status: true,
  startsOn: true,
  endsOn: true,
  oneWayDistanceKm: true,
  chargeableDistanceKm: true,
  distanceProvider: true,
  pricePerKmSarSnapshot: true,
  normalizedPickupLabel: true,
  normalizedDropoffLabel: true,
  packagePriceSar: true,
  addOnsPriceSar: true,
  distancePriceSar: true,
  extraRidersPriceSar: true,
  finalPriceSar: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, fullName: true, user: { select: { email: true } } } },
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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const adminId = auth.userId;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsed = adminSubscriptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const {
      userId,
      packageId,
      riderId,
      riderIds,
      subscriptionType,
      pickupLocation: pickupLocationRaw,
      dropoffLocation: dropoffLocationRaw,
      tripDirection,
      pickupTime,
      returnTime,
      weekdays,
      offDays,
      addOnIds,
      femaleDriverPreference,
      autoRenewal,
      startsOn,
      endsOn,
    } = parsed.data;

    // Normalise location inputs — accept both coord-objects (new) and plain strings (legacy)
    const pickup = resolveLocationInput(pickupLocationRaw);
    const dropoff = resolveLocationInput(dropoffLocationRaw);

    // Verify the target user exists
    const targetUser = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });
    if (!targetUser) {
      return NextResponse.json(
        { data: null, error: { message: 'Target user not found' } },
        { status: 404 },
      );
    }

    // Resolve rider IDs — must belong to the target user (not the admin)
    const resolvedRiderIds: string[] =
      riderIds && riderIds.length > 0 ? riderIds : riderId ? [riderId] : [];

    if (resolvedRiderIds.length > 0) {
      const riders = await prisma.rider.findMany({
        where: { id: { in: resolvedRiderIds }, parentId: userId, isActive: true },
        select: { id: true },
      });
      if (riders.length !== resolvedRiderIds.length) {
        return NextResponse.json(
          {
            data: null,
            error: { message: 'One or more riders not found or do not belong to the specified user' },
          },
          { status: 403 },
        );
      }
    }

    // Fetch add-ons
    let addOnsPriceSar = 0;
    const resolvedAddOnIds = addOnIds ?? [];
    if (resolvedAddOnIds.length > 0) {
      const foundAddOns = await prisma.addOn.findMany({
        where: { id: { in: resolvedAddOnIds }, isActive: true },
        select: { id: true, priceSar: true },
      });
      if (foundAddOns.length !== resolvedAddOnIds.length) {
        return NextResponse.json(
          { data: null, error: { message: 'One or more add-ons are invalid' } },
          { status: 400 },
        );
      }
      addOnsPriceSar = foundAddOns.reduce((sum, a) => sum + Number(a.priceSar), 0);
    }

    // Fetch package price
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

    // Calculate road distance server-side
    let oneWayDistanceKm = 0;
    let chargeableDistanceKm = 0;
    let distanceProvider: string | null = null;
    let pickupLat: number | null = null;
    let pickupLng: number | null = null;
    let dropoffLat: number | null = null;
    let dropoffLng: number | null = null;
    let normalizedPickupLabel: string | null = null;
    let normalizedDropoffLabel: string | null = null;

    try {
      const routeResult = pickup.hasCoords && dropoff.hasCoords
        ? await calculateRouteDistanceKmFromCoords(
            { lat: pickup.lat!, lng: pickup.lng!, label: pickup.label },
            { lat: dropoff.lat!, lng: dropoff.lng!, label: dropoff.label },
          )
        : await calculateRouteDistanceKm(pickup.label, dropoff.label);
      oneWayDistanceKm = routeResult.oneWayDistanceKm;
      chargeableDistanceKm = calculateChargeableDistanceKm(oneWayDistanceKm, tripDirection);
      distanceProvider = routeResult.providerUsed;
      pickupLat = routeResult.pickupCoordinates.lat;
      pickupLng = routeResult.pickupCoordinates.lng;
      dropoffLat = routeResult.dropoffCoordinates.lat;
      dropoffLng = routeResult.dropoffCoordinates.lng;
      normalizedPickupLabel = routeResult.normalizedPickupLabel;
      normalizedDropoffLabel = routeResult.normalizedDropoffLabel;
    } catch (err) {
      if (err instanceof DistanceError) {
        const status =
          err.code === 'NOT_CONFIGURED' || err.code === 'PROVIDER_NOT_IMPLEMENTED' ? 503 : 400;
        return NextResponse.json({ data: null, error: { message: err.message } }, { status });
      }
      return NextResponse.json(
        { data: null, error: { message: 'Could not calculate route distance. Please try again.' } },
        { status: 503 },
      );
    }

    // Server-side pricing
    const config = await getPricingConfig();
    const extraRiderCount = Math.max(0, resolvedRiderIds.length - 1);
    const pricing = calculateSubscriptionQuote(
      packagePriceSar,
      addOnsPriceSar,
      chargeableDistanceKm,
      extraRiderCount,
      config,
    );

    const primaryRiderId = resolvedRiderIds[0] ?? null;

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.userSubscription.create({
        data: {
          userId,
          riderId: primaryRiderId,
          packageId: packageId ?? null,
          subscriptionType,
          pickupLocation: pickup.label,
          dropoffLocation: dropoff.label,
          tripDirection,
          pickupTime,
          returnTime,
          femaleDriverPreference: femaleDriverPreference ?? false,
          autoRenewal: autoRenewal ?? true,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          startsOn: startsOn ? new Date(startsOn) : null,
          endsOn: endsOn ? new Date(endsOn) : null,
          oneWayDistanceKm,
          chargeableDistanceKm,
          distanceProvider,
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          normalizedPickupLabel,
          normalizedDropoffLabel,
          pricePerKmSarSnapshot: config.pricePerKmSar,
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
          addOns:
            resolvedAddOnIds.length > 0
              ? { create: resolvedAddOnIds.map((addOnId) => ({ addOnId })) }
              : undefined,
          subscriptionRiders:
            resolvedRiderIds.length > 0
              ? {
                  create: resolvedRiderIds.map((rid, idx) => ({
                    riderId: rid,
                    isPrimary: idx === 0,
                    priceMultiplier:
                      idx === 0 ? 1.0 : config.extraRiderSameDropoffMultiplier,
                  })),
                }
              : undefined,
        },
        select: ADMIN_SUB_SELECT,
      });

      await tx.notification.create({
        data: {
          userId,
          title: 'Subscription Created by Admin',
          message: `A ${subscriptionType} subscription has been created for you. ${
            tripDirection === 'ROUND_TRIP' ? 'Round-trip' : 'One-way'
          } (${chargeableDistanceKm} km). Final price: SAR ${pricing.finalPriceSar.toFixed(2)}.`,
          type: 'SUBSCRIPTION',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ADMIN_SUBSCRIPTION_CREATED',
          details: JSON.stringify({
            subscriptionId: sub.id,
            targetUserId: userId,
            subscriptionType,
            packageId,
            riderIds: resolvedRiderIds,
            tripDirection,
            oneWayDistanceKm,
            chargeableDistanceKm,
            distanceProvider,
            pricing,
          }),
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
