/**
 * GET /api/maps/geocode?q=...&lang=...&lat=&lng=
 *
 * Server-side Saudi-focused geocoding proxy. ORS when configured; Nominatim fallback.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { searchLocations } from '@/lib/maps/geocoding';
import type { GeocodeSearchResult } from '@/lib/maps/geocodeTypes';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

const querySchema = z
  .string()
  .min(2, 'Query must be at least 2 characters')
  .max(200, 'Query is too long');

function parseCoord(value: string | null, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
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
    const focusLat = parseCoord(searchParams.get('lat'), -90, 90);
    const focusLng = parseCoord(searchParams.get('lng'), -180, 180);

    const parsed = querySchema.safeParse(q);
    if (!parsed.success) {
      return NextResponse.json({ data: [], error: null });
    }

    let results: GeocodeSearchResult[] = [];
    try {
      results = await searchLocations(parsed.data, {
        lang,
        focus:
          focusLat != null && focusLng != null
            ? { lat: focusLat, lng: focusLng }
            : undefined,
      });
    } catch {
      results = [];
    }

    return NextResponse.json({ data: results, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
