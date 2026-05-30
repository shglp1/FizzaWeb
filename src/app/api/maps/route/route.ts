/**
 * GET /api/maps/route?pickupLat=&pickupLng=&dropoffLat=&dropoffLng=
 * Server-side route geometry — ORS key never exposed to client.
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getRouteGeometryFromCoords } from '@/lib/maps/distance';
import { ROUTE_GEOMETRY_FALLBACK_LABEL } from '@/lib/ui/driverPortal';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const pickupLat = Number(searchParams.get('pickupLat'));
    const pickupLng = Number(searchParams.get('pickupLng'));
    const dropoffLat = Number(searchParams.get('dropoffLat'));
    const dropoffLng = Number(searchParams.get('dropoffLng'));

    if (![pickupLat, pickupLng, dropoffLat, dropoffLng].every(Number.isFinite)) {
      return NextResponse.json(
        { data: null, error: { message: 'Valid pickup and dropoff coordinates are required.' } },
        { status: 400 },
      );
    }

    const latInRange = (v: number) => v >= -90 && v <= 90;
    const lngInRange = (v: number) => v >= -180 && v <= 180;
    if (
      !latInRange(pickupLat) || !lngInRange(pickupLng) ||
      !latInRange(dropoffLat) || !lngInRange(dropoffLng)
    ) {
      return NextResponse.json(
        { data: null, error: { message: 'Coordinates are out of range.' } },
        { status: 400 },
      );
    }

    const result = await getRouteGeometryFromCoords(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng },
    );

    return NextResponse.json({
      data: {
        coordinates: result.coordinates,
        source: result.source,
        fallbackLabel: result.source === 'approximate' ? ROUTE_GEOMETRY_FALLBACK_LABEL : null,
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
