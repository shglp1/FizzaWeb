/**
 * GET /api/tracking/[tripId]/location  — parent/admin fetches latest location
 * POST — driver pushes GPS update
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { z } from 'zod';
import { isLocationSharingAllowed } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { processLocationProximityUpdate } from '@/lib/trips/tripProximity';
import { getCachedLiveEta } from '@/lib/tracking/liveEtaCache';
import { shouldThrottleGps, recordGpsWrite } from '@/lib/tracking/gpsThrottle';
import {
  isTerminalTripStatus,
  parentCanSeeLiveLocation,
} from '@/lib/tracking/trackingVisibility';

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'DRIVER' && auth.role !== 'ADMIN') {
      return NextResponse.json({ data: null, error: { message: 'Only drivers can push location' } }, { status: 403 });
    }

    const { tripId } = await params;
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 });
    }
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { message: 'lat and lng are required numbers' } }, { status: 400 });
    }

    const { lat, lng } = parsed.data;

    const driver = await prisma.driver.findFirst({
      where: { profileId: auth.userId },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ data: null, error: { message: 'Driver profile not found' } }, { status: 404 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true, driverId: true, status: true, scheduledPickupTime: true,
        pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
        subscription: { select: { userId: true } },
        rider: { select: { parentId: true } },
        driver: { select: { profileId: true } },
      },
    });
    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }
    if (auth.role !== 'ADMIN' && trip.driverId !== driver.id) {
      return NextResponse.json({ data: null, error: { message: 'Not your trip' } }, { status: 403 });
    }

    if (
      auth.role !== 'ADMIN' &&
      !isLocationSharingAllowed(trip.status as TripStatus, trip.scheduledPickupTime)
    ) {
      return NextResponse.json({
        data: null,
        error: { message: 'Location sharing is not open yet. It opens 10 minutes before pickup or when the trip is active.' },
      }, { status: 422 });
    }

    // Throttle persistence per trip to avoid GPS write spam. Runs only after all
    // auth/ownership/sharing checks above, so security is never bypassed.
    if (shouldThrottleGps(tripId)) {
      return NextResponse.json({ data: { ok: true, throttled: true }, error: null });
    }

    await prisma.driverLocation.create({
      data: { driverId: driver.id, tripId, lat, lng },
    });
    recordGpsWrite(tripId);

    await processLocationProximityUpdate(
      { ...trip, status: trip.status as TripStatus },
      lat,
      lng,
    );

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { tripId } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true, status: true, scheduledPickupTime: true,
        pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
        subscription: { select: { userId: true } },
        riderId: true, driverId: true,
      },
    });
    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    if (auth.role !== 'ADMIN' && auth.role !== 'DRIVER') {
      const parentViaSub = trip.subscription?.userId === auth.userId;
      let isParent = parentViaSub;
      if (!isParent && trip.riderId) {
        const rider = await prisma.rider.findFirst({
          where: { id: trip.riderId, parentId: auth.userId },
          select: { id: true },
        });
        isParent = !!rider;
      }
      if (!isParent) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    }

    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: { id: true },
      });
      if (trip.driverId !== driver?.id) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    }

    const terminal = isTerminalTripStatus(trip.status);
    const isParentRole = auth.role !== 'ADMIN' && auth.role !== 'DRIVER';
    const trackingVisible = isParentRole
      ? parentCanSeeLiveLocation(trip.status, trip.scheduledPickupTime)
      : !terminal;

    const cachedLiveEta = getCachedLiveEta(tripId);
    const liveEta = cachedLiveEta === undefined ? null : cachedLiveEta;

    if (!trackingVisible) {
      const tooEarly = isParentRole && !terminal;
      return NextResponse.json({
        data: {
          location: null,
          tooEarly,
          trackingVisible: false,
          terminal,
          tripStatus: trip.status,
          liveEta: null,
        },
        error: null,
      });
    }

    const location = await prisma.driverLocation.findFirst({
      where: { tripId },
      orderBy: { recordedAt: 'desc' },
      select: { lat: true, lng: true, recordedAt: true },
    });

    if (!location) {
      return NextResponse.json({
        data: {
          location: null,
          trackingVisible: true,
          terminal: false,
          tripStatus: trip.status,
          liveEta,
        },
        error: null,
      });
    }

    const stale = (Date.now() - new Date(location.recordedAt).getTime()) > 60_000;

    return NextResponse.json({
      data: {
        location: { lat: location.lat, lng: location.lng, recordedAt: location.recordedAt, stale },
        trackingVisible: true,
        terminal: false,
        tripStatus: trip.status,
        liveEta,
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
