/**
 * GET /api/maps/reverse?lat=&lng=&language=ar|en
 *
 * Server-side reverse geocoding — resolves map pin coordinates to place names.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { reverseGeocodeLocation } from '@/lib/maps/geocoding';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

const coordSchema = z.coerce.number();

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 'maps:reverse', RATE_LIMITS.geocode);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const latParsed = coordSchema.safeParse(searchParams.get('lat'));
    const lngParsed = coordSchema.safeParse(searchParams.get('lng'));
    const lang = searchParams.get('language') === 'ar' || searchParams.get('lang') === 'ar' ? 'ar' : 'en';

    if (!latParsed.success || !lngParsed.success) {
      return NextResponse.json(
        { data: null, error: { message: 'Valid lat and lng are required' } },
        { status: 400 },
      );
    }

    const lat = latParsed.data;
    const lng = lngParsed.data;

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { data: null, error: { message: 'Coordinates are out of range' } },
        { status: 400 },
      );
    }

    const result = await reverseGeocodeLocation(lat, lng, { lang });

    if (!result) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message:
              'We could not identify the place name. You can edit the label manually.',
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
