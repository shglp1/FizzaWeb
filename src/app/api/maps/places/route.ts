/**
 * GET /api/maps/places?bbox=minLng,minLat,maxLng,maxLat&types=&language=ar|en
 * Verified local places inside map bounds for overlay labels.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { listMapPlacesInBbox } from '@/lib/maps/localPlaceSearch';
import type { MapPlaceType } from '@prisma/client';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

const bboxSchema = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 'maps:places-bbox', RATE_LIMITS.geocode);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const bboxRaw = searchParams.get('bbox') ?? '';
    const language = searchParams.get('language') === 'ar' ? 'ar' : 'en';
    const typesRaw = searchParams.get('types')?.trim() ?? '';

    const parsed = bboxSchema.safeParse(bboxRaw);
    if (!parsed.success) {
      return NextResponse.json({ data: [], error: { message: 'Invalid bbox' } }, { status: 400 });
    }

    const [minLng, minLat, maxLng, maxLat] = parsed.data.split(',').map(Number);
    const types = typesRaw
      ? (typesRaw.split(',').filter(Boolean) as MapPlaceType[])
      : undefined;

    const places = await listMapPlacesInBbox(minLng, minLat, maxLng, maxLat, {
      types,
      language,
    });

    return NextResponse.json({ data: places, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
