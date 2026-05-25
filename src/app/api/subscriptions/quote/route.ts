import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { subscriptionQuoteSchema } from '@/lib/validations/subscription';
import { getPricingConfig, calculateSubscriptionQuote } from '@/lib/pricing/subscriptionPricing';
import { computeServiceDayBreakdown } from '@/lib/pricing/serviceDays';
import {
  calculateRouteDistanceKmFromCoords,
  calculateChargeableDistanceKm,
  DistanceError,
} from '@/lib/maps/distance';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { validatePromoCode, computePromoDiscount } from '@/lib/promo/promoCode';

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 'subscriptions:quote', RATE_LIMITS.subscriptionQuote);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = subscriptionQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const {
      packageId, addOnIds, pickupLocation, dropoffLocation,
      tripDirection, riderIds, weekdays, startsOn, promoCode,
    } = parsed.data;

    // Validate all riderIds belong to this user
    const riders = await prisma.rider.findMany({
      where: { id: { in: riderIds }, parentId: auth.userId, isActive: true },
      select: { id: true, name: true },
    });
    if (riders.length !== riderIds.length) {
      return NextResponse.json(
        { data: null, error: { message: 'One or more riders not found or do not belong to you' } },
        { status: 403 },
      );
    }

    // Fetch package price + billing cycle
    let packagePriceSar = 0;
    let packageName: string | null = null;
    let billingCycle = 'monthly'; // default fallback
    if (packageId) {
      const pkg = await prisma.subscriptionPackage.findFirst({
        where: { id: packageId, isActive: true },
        select: { priceSar: true, name: true, billingCycle: true },
      });
      if (!pkg) {
        return NextResponse.json(
          { data: null, error: { message: 'Package not found' } },
          { status: 404 },
        );
      }
      packagePriceSar = Number(pkg.priceSar);
      packageName = pkg.name;
      billingCycle = pkg.billingCycle;
    }

    // Fetch add-ons prices
    let addOnsPriceSar = 0;
    const addOnDetails: { id: string; name: string; priceSar: number }[] = [];
    if (addOnIds && addOnIds.length > 0) {
      const foundAddOns = await prisma.addOn.findMany({
        where: { id: { in: addOnIds }, isActive: true },
        select: { id: true, name: true, priceSar: true },
      });
      if (foundAddOns.length !== addOnIds.length) {
        return NextResponse.json(
          { data: null, error: { message: 'One or more add-ons are invalid' } },
          { status: 400 },
        );
      }
      addOnsPriceSar = foundAddOns.reduce((sum, a) => sum + Number(a.priceSar), 0);
      addOnDetails.push(
        ...foundAddOns.map((a) => ({ id: a.id, name: a.name, priceSar: Number(a.priceSar) })),
      );
    }

    // Calculate road distance using pre-selected coordinates (server-side only)
    // The LocationPicker already resolved addresses to precise lat/lng client-side
    // via /api/maps/geocode. We skip geocoding and go straight to routing.
    let routeResult: Awaited<ReturnType<typeof calculateRouteDistanceKmFromCoords>>;
    try {
      routeResult = await calculateRouteDistanceKmFromCoords(
        {
          lat: pickupLocation.latitude,
          lng: pickupLocation.longitude,
          label: pickupLocation.label,
        },
        {
          lat: dropoffLocation.latitude,
          lng: dropoffLocation.longitude,
          label: dropoffLocation.label,
        },
      );
    } catch (err) {
      if (err instanceof DistanceError) {
        if (err.code === 'NOT_CONFIGURED' || err.code === 'PROVIDER_NOT_IMPLEMENTED') {
          return NextResponse.json(
            {
              data: null,
              error: {
                message:
                  'Location pricing is currently unavailable because distance calculation is not configured. Please contact support.',
              },
            },
            { status: 503 },
          );
        }
        if (err.code === 'ROUTE_FAILED') {
          return NextResponse.json(
            {
              data: null,
              error: {
                message:
                  'We could not calculate a route between these two locations. Try selecting more specific addresses.',
              },
            },
            { status: 422 },
          );
        }
        return NextResponse.json(
          {
            data: null,
            error: {
              message: 'Location service is temporarily unavailable. Please try again later.',
            },
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          data: null,
          error: { message: 'Could not reach the pricing service. Check your connection and try again.' },
        },
        { status: 503 },
      );
    }

    const { oneWayDistanceKm, providerUsed, pickupCoordinates, dropoffCoordinates,
      normalizedPickupLabel, normalizedDropoffLabel } = routeResult;

    // Per-day chargeable distance (1× or 2× depending on direction)
    const dailyChargeableDistanceKm = calculateChargeableDistanceKm(oneWayDistanceKm, tripDirection);

    // Compute service-day breakdown using weekdays + package billing cycle
    const serviceDays = computeServiceDayBreakdown(startsOn, billingCycle, weekdays);
    const { actualServiceDays, serviceStartDate, serviceEndDate } = serviceDays;

    // Total chargeable distance across all service days
    const totalChargeableDistanceKm = round2(dailyChargeableDistanceKm * actualServiceDays);

    const config = await getPricingConfig();
    const extraRiderCount = Math.max(0, riderIds.length - 1);

    // Price is calculated on the TOTAL chargeable distance, not daily
    const breakdown = calculateSubscriptionQuote(
      packagePriceSar,
      addOnsPriceSar,
      totalChargeableDistanceKm,
      extraRiderCount,
      config,
    );

    let promoDiscountSar = 0;
    let promoMeta: { code: string; partnerName: string | null; discountPercent: number } | null = null;
    if (promoCode?.trim()) {
      const promoResult = await validatePromoCode(promoCode, auth.userId);
      if (!promoResult.ok) {
        return NextResponse.json({ data: null, error: { message: promoResult.message } }, { status: 400 });
      }
      promoDiscountSar = computePromoDiscount(breakdown.finalPriceSar, promoResult.promo.discountPercent);
      promoMeta = {
        code: promoResult.promo.code,
        partnerName: promoResult.promo.partnerName,
        discountPercent: promoResult.promo.discountPercent,
      };
    }
    const subtotalSar = breakdown.finalPriceSar;
    const finalPriceSar = round2(Math.max(0, subtotalSar - promoDiscountSar));

    return NextResponse.json({
      data: {
        quote: {
          // ── Distance ────────────────────────────────────────────────────────
          oneWayDistanceKm,
          dailyChargeableDistanceKm,
          totalChargeableDistanceKm,
          tripDirection,
          // ── Service days ────────────────────────────────────────────────────
          weekdays,
          actualServiceDays,
          serviceStartDate,
          serviceEndDate,
          billingCycle,
          // ── Price breakdown ─────────────────────────────────────────────────
          packagePriceSar: breakdown.packagePriceSar,
          addOnsPriceSar: breakdown.addOnsPriceSar,
          pricePerKmSar: config.pricePerKmSar,
          distanceChargeSar: breakdown.distancePriceSar,
          primaryFinalSar: breakdown.primaryFinalSar,
          extraRiderCount,
          extraRiderSameDropoffMultiplier: config.extraRiderSameDropoffMultiplier,
          extraRiderChargeSar: breakdown.extraRidersPriceSar,
          subtotalSar,
          promoDiscountSar,
          promo: promoMeta,
          finalPriceSar,
          // ── Meta ─────────────────────────────────────────────────────────────
          distanceProvider: providerUsed,
          distanceApproximate: routeResult.approximateRoute ?? false,
          pickupCoordinates,
          dropoffCoordinates,
          normalizedPickupLabel,
          normalizedDropoffLabel,
          riderCount: riderIds.length,
          packageName,
          addOns: addOnDetails,
          riders: riders.map((r) => ({ id: r.id, name: r.name })),
          currency: 'SAR',
        },
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
