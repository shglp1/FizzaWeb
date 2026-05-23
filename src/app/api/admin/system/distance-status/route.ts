/**
 * GET /api/admin/system/distance-status
 *
 * Returns the distance provider configuration status for the admin panel.
 * The ORS API key is never returned — only whether it is configured.
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { isDistanceConfigured } from '@/lib/maps/distance';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const configured = isDistanceConfigured();
    const provider = (process.env.DISTANCE_PROVIDER ?? 'OPENROUTESERVICE').toUpperCase();

    return NextResponse.json({
      data: {
        configured,
        provider,
        providerLabel: provider === 'OPENROUTESERVICE' ? 'OpenRouteService' : provider,
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
