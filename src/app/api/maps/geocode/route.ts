/**
 * GET /api/maps/geocode?q=...
 *
 * Server-side geocoding proxy. Calls OpenRouteService on behalf of the
 * authenticated user. The ORS API key is NEVER sent to the browser.
 *
 * Returns normalised location suggestions for the LocationPicker component.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { searchLocations, DistanceError } from '@/lib/maps/distance';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

const querySchema = z
  .string()
  .min(3, 'Query must be at least 3 characters')
  .max(200, 'Query is too long');

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 'maps:geocode', RATE_LIMITS.geocode);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? '';

    const parsed = querySchema.safeParse(q);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      );
    }

    let results;
    try {
      results = await searchLocations(parsed.data);
    } catch (err) {
      if (err instanceof DistanceError) {
        if (err.code === 'NOT_CONFIGURED') {
          return NextResponse.json(
            {
              data: null,
              error: {
                message:
                  'Location search is not configured. Please contact the administrator.',
              },
            },
            { status: 503 },
          );
        }
        // ORS returned an error or is unreachable
        return NextResponse.json(
          {
            data: null,
            error: {
              message: 'Location service is temporarily unavailable. Please try again later.',
            },
          },
          { status: 502 },
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
