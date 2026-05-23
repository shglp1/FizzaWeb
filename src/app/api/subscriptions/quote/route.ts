import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { subscriptionQuoteSchema } from '@/lib/validations/subscription';
import { getPricingConfig, calculateSubscriptionQuote } from '@/lib/pricing/subscriptionPricing';
import {
  calculateRouteDistanceKmFromCoords,
  calculateChargeableDistanceKm,
  DistanceError,
} from '@/lib/maps/distance';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

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

    const { packageId, addOnIds, pickupLocation, dropoffLocation, tripDirection, riderIds } =
      parsed.data;

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

    // Fetch package price
    let packagePriceSar = 0;
    let packageName: string | null = null;
    if (packageId) {
      const pkg = await prisma.subscriptionPackage.findFirst({
        where: { id: packageId, isActive: true },
        select: { priceSar: true, name: true },
      });
      if (!pkg) {
        return NextResponse.json(
          { data: null, error: { message: 'Package not found' } },
          { status: 404 },
        );
      }
      packagePriceSar = Number(pkg.priceSar);
      packageName = pkg.name;
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

    const chargeableDistanceKm = calculateChargeableDistanceKm(oneWayDistanceKm, tripDirection);
    const config = await getPricingConfig();
    const extraRiderCount = Math.max(0, riderIds.length - 1);

    const breakdown = calculateSubscriptionQuote(
      packagePriceSar,
      addOnsPriceSar,
      chargeableDistanceKm,
      extraRiderCount,
      config,
    );

    return NextResponse.json({
      data: {
        quote: {
          packagePriceSar: breakdown.packagePriceSar,
          addOnsPriceSar: breakdown.addOnsPriceSar,
          oneWayDistanceKm,
          chargeableDistanceKm,
          tripDirection,
          pricePerKmSar: config.pricePerKmSar,
          distanceChargeSar: breakdown.distancePriceSar,
          primaryFinalSar: breakdown.primaryFinalSar,
          extraRiderCount,
          extraRiderSameDropoffMultiplier: config.extraRiderSameDropoffMultiplier,
          extraRiderChargeSar: breakdown.extraRidersPriceSar,
          finalPriceSar: breakdown.finalPriceSar,
          distanceProvider: providerUsed,
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
