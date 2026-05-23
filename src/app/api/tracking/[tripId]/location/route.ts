/**
 * POST /api/tracking/[tripId]/location  — driver pushes GPS update
 * GET  /api/tracking/[tripId]/location  — parent/admin fetches latest location
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { z } from 'zod';

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

    // Find the driver record
    const driver = await prisma.driver.findFirst({
      where: { profileId: auth.userId },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ data: null, error: { message: 'Driver profile not found' } }, { status: 404 });
    }

    // Verify the driver is assigned to this trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, driverId: true, status: true },
    });
    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }
    if (auth.role !== 'ADMIN' && trip.driverId !== driver.id) {
      return NextResponse.json({ data: null, error: { message: 'Not your trip' } }, { status: 403 });
    }

    await prisma.driverLocation.create({
      data: { driverId: driver.id, tripId, lat, lng },
    });

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
      select: { id: true, subscription: { select: { userId: true } }, driverId: true },
    });
    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    // Access control for parents
    if (auth.role !== 'ADMIN' && auth.role !== 'DRIVER') {
      if (trip.subscription?.userId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    }

    const location = await prisma.driverLocation.findFirst({
      where: { tripId },
      orderBy: { recordedAt: 'desc' },
      select: { lat: true, lng: true, recordedAt: true },
    });

    if (!location) {
      return NextResponse.json({ data: { location: null }, error: null });
    }

    const stale = (Date.now() - new Date(location.recordedAt).getTime()) > 60_000;
    return NextResponse.json({
      data: { location: { lat: location.lat, lng: location.lng, recordedAt: location.recordedAt, stale } },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
