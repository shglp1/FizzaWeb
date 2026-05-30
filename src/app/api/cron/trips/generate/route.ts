/**
 * GET /api/cron/trips/generate
 * Nightly automatic trip generation (Vercel Cron or external scheduler).
 * Authorization: Bearer CRON_SECRET
 */
import { NextResponse } from 'next/server';
import { generateTrips, runDispatchHealthCheck } from '@/lib/dispatch/generateTrips';
import { verifyCronSecret } from '@/lib/cron/verifyCronSecret';

export async function GET(req: Request) {
  try {
    const gate = verifyCronSecret(req);
    if (!gate.ok) return gate.response;

    const [generation, health] = await Promise.all([
      generateTrips({ triggeredBy: 'CRON', actorUserId: null }),
      runDispatchHealthCheck(),
    ]);

    return NextResponse.json({
      data: { generation, health },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/cron/trips/generate]', err);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
