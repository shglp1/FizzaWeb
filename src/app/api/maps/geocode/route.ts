/**
 * GET /api/maps/geocode?q=...&lang=...&lat=&lng=
 *
 * Server-side Saudi-focused geocoding proxy. ORS when configured; Nominatim fallback.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { searchLocations, GeocodingError } from '@/lib/maps/geocoding';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

const querySchema = z
  .string()
  .min(3, 'Query must be at least 3 characters')
  .max(200, 'Query is too long');

function parseCoord(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 'maps:geocode', RATE_LIMITS.geocode);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? '';
    const lang = searchParams.get('lang') === 'ar' ? 'ar' : 'en';
    const focusLat = parseCoord(searchParams.get('lat'));
    const focusLng = parseCoord(searchParams.get('lng'));

    const parsed = querySchema.safeParse(q);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      );
    }

    let results;
    try {
      results = await searchLocations(parsed.data, {
        lang,
        focus:
          focusLat != null && focusLng != null
            ? { lat: focusLat, lng: focusLng }
            : undefined,
      });
    } catch (err) {
      if (err instanceof GeocodingError) {
        return NextResponse.json(
          { data: null, error: { message: err.message } },
          { status: err.message.includes('not configured') ? 503 : 502 },
        );
      }
      return NextResponse.json(
        {
          data: null,
          error: { message: 'Location service is temporarily unavailable. Please try again later.' },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ data: results, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
