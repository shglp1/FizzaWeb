import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { subscriptionCreateSchema } from '@/lib/validations/subscription';
import { getPricingConfig, calculateSubscriptionQuote } from '@/lib/pricing/subscriptionPricing';
import { computeServiceDayBreakdown } from '@/lib/pricing/serviceDays';
import {
  calculateRouteDistanceKm,
  calculateRouteDistanceKmFromCoords,
  calculateChargeableDistanceKm,
  DistanceError,
} from '@/lib/maps/distance';
import { validatePromoCode, computePromoDiscount } from '@/lib/promo/promoCode';
import { resolveLoyaltyRedemptionForQuote } from '@/lib/loyalty/resolveLoyaltyQuote';
import { createLocationReviewIfNeeded } from '@/lib/maps/locationReview';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

/**
 * Normalise a location value that may be either a plain string (legacy) or
 * a coordinate object from LocationPicker (new flow).
 */
function resolveLocationInput(
  loc: string | { label: string; latitude: number; longitude: number },
): { label: string; lat: number | null; lng: number | null; hasCoords: boolean } {
  if (typeof loc === 'string') {
    return { label: loc, lat: null, lng: null, hasCoords: false };
  }
  return {
    label: loc.label,
    lat: loc.latitude,
    lng: loc.longitude,
    hasCoords: true,
  };
}

// ─── SELECT shape ─────────────────────────────────────────────────────────────

const SUBSCRIPTION_SELECT = {
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
  rider: { select: { id: true, name: true, relationship: true, school: true, grade: true, specialNeeds: true } },
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
      rider: { select: { id: true, name: true, relationship: true, school: true, grade: true, specialNeeds: true } },
    },
  },
  assignedDriver: {
    select: {
      id: true,
      rating: true,
      profile: { select: { fullName: true, avatarUrl: true, phone: true } },
      vehicle: { select: { model: true, color: true, plateNumber: true, capacity: true } },
    },
  },
} as const;

// ─── GET /api/subscriptions ───────────────────────────────────────────────────

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

// ─── POST /api/subscriptions ──────────────────────────────────────────────────

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
      pickupPhotoUrl,
      dropoffPhotoUrl,
      promoCode,
      loyaltyPointsToRedeem,
      pickupLocationMeta,
      dropoffLocationMeta,
    } = parsed.data;

    // Normalise location inputs — accept both coord-objects and plain strings
    const pickup = resolveLocationInput(pickupLocationRaw);
    const dropoff = resolveLocationInput(dropoffLocationRaw);

    // Resolve which rider IDs to use: prefer riderIds array, fall back to single riderId
    const resolvedRiderIds: string[] =
      riderIds && riderIds.length > 0 ? riderIds : riderId ? [riderId] : [];

    // Validate all rider ownerships
    if (resolvedRiderIds.length > 0) {
      const riders = await prisma.rider.findMany({
        where: { id: { in: resolvedRiderIds }, parentId: auth.userId, isActive: true },
        select: { id: true },
      });
      if (riders.length !== resolvedRiderIds.length) {
        return NextResponse.json(
          {
            data: null,
            error: { message: 'One or more riders not found or do not belong to you' },
          },
          { status: 403 },
        );
      }
    }

    // Fetch add-ons
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

    // Fetch package price + billing cycle server-side
    let packagePriceSar = 0;
    let billingCycle = 'monthly';
    if (packageId) {
      const pkg = await prisma.subscriptionPackage.findFirst({
        where: { id: packageId, isActive: true },
        select: { priceSar: true, billingCycle: true },
      });
      if (!pkg) {
        return NextResponse.json(
          { data: null, error: { message: 'Package not found' } },
          { status: 404 },
        );
      }
      packagePriceSar = Number(pkg.priceSar);
      billingCycle = pkg.billingCycle;
    }

    // ── Calculate road distance server-side (never trust the client's quoted price) ──
    let oneWayDistanceKm = 0;
    let chargeableDistanceKm = 0;
    let distanceProvider: string | null = null;
    let pickupLat: number | null = null;
    let pickupLng: number | null = null;
    let dropoffLat: number | null = null;
    let dropoffLng: number | null = null;
    let normalizedPickupLabel: string | null = null;
    let normalizedDropoffLabel: string | null = null;

    let distanceApproximate = false;
    try {
      let routeResult;
      if (pickup.hasCoords && dropoff.hasCoords) {
        routeResult = await calculateRouteDistanceKmFromCoords(
          { lat: pickup.lat!, lng: pickup.lng!, label: pickup.label },
          { lat: dropoff.lat!, lng: dropoff.lng!, label: dropoff.label },
        );
      } else {
        routeResult = await calculateRouteDistanceKm(pickup.label, dropoff.label);
      }

      oneWayDistanceKm = routeResult.oneWayDistanceKm;
      chargeableDistanceKm = calculateChargeableDistanceKm(oneWayDistanceKm, tripDirection);
      distanceProvider = routeResult.providerUsed;
      distanceApproximate = routeResult.approximateRoute ?? false;
      pickupLat = routeResult.pickupCoordinates.lat;
      pickupLng = routeResult.pickupCoordinates.lng;
      dropoffLat = routeResult.dropoffCoordinates.lat;
      dropoffLng = routeResult.dropoffCoordinates.lng;
      normalizedPickupLabel = routeResult.normalizedPickupLabel;
      normalizedDropoffLabel = routeResult.normalizedDropoffLabel;
    } catch (err) {
      if (err instanceof DistanceError) {
        const status =
          err.code === 'NOT_CONFIGURED' || err.code === 'PROVIDER_NOT_IMPLEMENTED' ? 503 : 422;
        const message =
          err.code === 'NOT_CONFIGURED'
            ? 'Location pricing is currently unavailable because distance calculation is not configured. Please contact support.'
            : err.code === 'ROUTE_FAILED'
            ? 'We could not calculate a route between these two locations. Try selecting more specific addresses.'
            : err.message;
        return NextResponse.json(
          { data: null, error: { message } },
          { status },
        );
      }
      return NextResponse.json(
        { data: null, error: { message: 'Could not reach the pricing service. Check your connection and try again.' } },
        { status: 503 },
      );
    }

    // ── Service-day breakdown (multi-day pricing) ─────────────────────────────
    const dailyChargeableDistanceKm = chargeableDistanceKm; // per-day (already 1× or 2×)
    const serviceDays = computeServiceDayBreakdown(startsOn, billingCycle, weekdays);
    const totalChargeableDistanceKm = round2(dailyChargeableDistanceKm * serviceDays.actualServiceDays);

    // ── Server-side pricing calculation (final price, never trust the client) ──
    const config = await getPricingConfig();
    const extraRiderCount = Math.max(0, resolvedRiderIds.length - 1);
    const pricing = calculateSubscriptionQuote(
      packagePriceSar,
      addOnsPriceSar,
      totalChargeableDistanceKm, // charge across ALL service days
      extraRiderCount,
      config,
    );

    let promoCodeId: string | null = null;
    let promoDiscountSar = 0;
    const subtotalSar = pricing.finalPriceSar;
    if (promoCode?.trim()) {
      const promoResult = await validatePromoCode(promoCode, auth.userId);
      if (!promoResult.ok) {
        return NextResponse.json({ data: null, error: { message: promoResult.message } }, { status: 400 });
      }
      promoCodeId = promoResult.promo.id;
      promoDiscountSar = computePromoDiscount(subtotalSar, promoResult.promo.discountPercent);
    }

    const loyaltyResult = await resolveLoyaltyRedemptionForQuote({
      userId: auth.userId,
      subtotalSar,
      promoDiscountSar,
      pointsToRedeem: loyaltyPointsToRedeem ?? 0,
    });
    if (!loyaltyResult.ok) {
      return NextResponse.json({ data: null, error: { message: loyaltyResult.message } }, { status: 400 });
    }

    const loyaltyPointsRedeemed = loyaltyResult.pointsUsed;
    const loyaltyDiscountSar = loyaltyResult.loyaltyDiscountSar;
    const finalPriceSar = loyaltyResult.finalPriceSar;

    // Primary rider = first in list (backward compat riderId field)
    const primaryRiderId = resolvedRiderIds[0] ?? null;

    // Store the human-readable label as the string location field in the DB
    const pickupLocationStr = pickup.label;
    const dropoffLocationStr = dropoff.label;

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.userSubscription.create({
        data: {
          userId: auth.userId,
          riderId: primaryRiderId,
          packageId: packageId ?? null,
          subscriptionType,
          pickupLocation: pickupLocationStr,
          dropoffLocation: dropoffLocationStr,
          tripDirection,
          pickupTime,
          returnTime,
          femaleDriverPreference: femaleDriverPreference ?? false,
          autoRenewal: autoRenewal ?? true,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          startsOn: startsOn ? new Date(startsOn) : null,
          // Distance & coordinate snapshots (immutable after creation)
          oneWayDistanceKm,
          chargeableDistanceKm: totalChargeableDistanceKm, // total across all service days
          distanceProvider,
          distanceApproximate,
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          normalizedPickupLabel,
          normalizedDropoffLabel,
          pickupPhotoUrl: pickupPhotoUrl ?? null,
          dropoffPhotoUrl: dropoffPhotoUrl ?? null,
          pricePerKmSarSnapshot: config.pricePerKmSar,
          // Multi-day breakdown fields
          actualServiceDays: serviceDays.actualServiceDays,
          dailyChargeableDistanceKm,
          totalChargeableDistanceKm,
          // Price snapshots (payment always uses these, never live recalculation)
          packagePriceSar: pricing.packagePriceSar,
          addOnsPriceSar: pricing.addOnsPriceSar,
          distancePriceSar: pricing.distancePriceSar,
          extraRidersPriceSar: pricing.extraRidersPriceSar,
          subtotalSar,
          promoCodeId,
          promoDiscountSar,
          loyaltyPointsRedeemed,
          loyaltyDiscountSar,
          finalPriceSar,
          schedules: {
            create: weekdays.map((day) => ({
              weekday: day,
              isOffDay: (offDays ?? []).includes(day),
            })),
          },
          addOns:
            addOnIds && addOnIds.length > 0
              ? { create: addOnIds.map((addOnId) => ({ addOnId })) }
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
        select: SUBSCRIPTION_SELECT,
      });

      await tx.notification.create({
        data: {
          userId: auth.userId,
          title: 'Subscription Created',
          message: `Your ${subscriptionType} subscription has been created and is pending payment. ${
            tripDirection === 'ROUND_TRIP' ? 'Round-trip' : 'One-way'
          }, ${serviceDays.actualServiceDays} service days (${totalChargeableDistanceKm} km total).${
            promoDiscountSar > 0 ? ` Promo discount: SAR ${promoDiscountSar.toFixed(2)}.` : ''
          } Final price: SAR ${finalPriceSar.toFixed(2)}.${
            loyaltyDiscountSar > 0 ? ` Loyalty discount: SAR ${loyaltyDiscountSar.toFixed(2)} (${loyaltyPointsRedeemed} points).` : ''
          }`,
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
            tripDirection,
            pickupLabel: pickupLocationStr,
            dropoffLabel: dropoffLocationStr,
            pickupLat,
            pickupLng,
            dropoffLat,
            dropoffLng,
            oneWayDistanceKm,
            chargeableDistanceKm,
            distanceProvider,
            pricing,
          }),
          ipAddress: getIp(req),
        },
      });

      return sub;
    });

    if (pickup.hasCoords) {
      await createLocationReviewIfNeeded({
        subscriptionId: subscription.id,
        locationKind: 'PICKUP',
        label: pickup.label,
        latitude: pickup.lat!,
        longitude: pickup.lng!,
        source: pickupLocationMeta?.source ?? null,
        confidence: pickupLocationMeta?.confidence ?? null,
        placeId: pickupLocationMeta?.placeId ?? null,
        isVerifiedPlace: pickupLocationMeta?.isVerifiedPlace,
        isManual: pickupLocationMeta?.isManual,
      });
    }
    if (dropoff.hasCoords) {
      await createLocationReviewIfNeeded({
        subscriptionId: subscription.id,
        locationKind: 'DROPOFF',
        label: dropoff.label,
        latitude: dropoff.lat!,
        longitude: dropoff.lng!,
        source: dropoffLocationMeta?.source ?? null,
        confidence: dropoffLocationMeta?.confidence ?? null,
        placeId: dropoffLocationMeta?.placeId ?? null,
        isVerifiedPlace: dropoffLocationMeta?.isVerifiedPlace,
        isManual: dropoffLocationMeta?.isManual,
      });
    }

    return NextResponse.json({ data: subscription, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
