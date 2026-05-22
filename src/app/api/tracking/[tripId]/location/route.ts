import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { driverLocationSchema } from '@/lib/validations/trip';

// ── GPS throttle: minimum seconds between accepted location updates per driver ─
// Prevents a single driver flooding the DB at high frequency.
// In production, replace with a Redis-based sliding window for multi-instance support.
const GPS_MIN_INTERVAL_SECONDS = 5;
const lastUpdateTime = new Map<string, number>(); // driverId → epoch ms

export async function POST(
  req: Request,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'DRIVER') {
      return NextResponse.json(
        { data: null, error: { message: 'Only drivers can update location' } },
        { status: 403 },
      );
    }

    const { tripId } = await context.params;

    const body = await req.json();
    const parsed = driverLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid location data' } },
        { status: 400 },
      );
    }

    // Verify driver is assigned to this trip and it is active
    const driver = await prisma.driver.findFirst({
      where: { profileId: auth.userId },
      select: { id: true },
    });

    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver profile not found' } },
        { status: 403 },
      );
    }

    // ── In-process GPS throttle ────────────────────────────────────────────────
    // Rejects updates that arrive faster than GPS_MIN_INTERVAL_SECONDS.
    // Note: this is per-process; use Redis for multi-replica deployments.
    const now = Date.now();
    const last = lastUpdateTime.get(driver.id) ?? 0;
    if (now - last < GPS_MIN_INTERVAL_SECONDS * 1000) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `Location updates are throttled to once every ${GPS_MIN_INTERVAL_SECONDS} seconds`,
          },
        },
        { status: 429 },
      );
    }
    lastUpdateTime.set(driver.id, now);

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        driverId: driver.id,
        status: { in: ['DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP'] },
      },
      select: { id: true },
    });

    if (!trip) {
      return NextResponse.json(
        { data: null, error: { message: 'Active trip not found or driver not assigned' } },
        { status: 403 },
      );
    }

    const location = await prisma.driverLocation.create({
      data: {
        driverId: driver.id,
        tripId,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        recordedAt: new Date(),
      },
      select: { lat: true, lng: true, recordedAt: true },
    });

    return NextResponse.json({ data: location, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
