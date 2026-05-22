/**
 * GET /api/health
 *
 * Lightweight liveness probe for uptime monitors and Vercel deployment checks.
 * Returns a JSON body with status, timestamp, and app version.
 *
 * Deliberately minimal — does NOT check the database connection (a DB call would
 * add latency and introduce a new failure mode). For database health, use
 * GET /api/health/db (admin-protected, separate route).
 *
 * No secrets are exposed.
 */
import { NextResponse } from 'next/server';
// package.json is in the project root — two dirs up from src/app/api/health/
// resolveJsonModule is enabled in tsconfig.json
import pkg from '../../../../package.json';

export async function GET() {
  return NextResponse.json(
    {
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: pkg.version,
        // db is intentionally not checked here — see /api/health/db
        db: 'not_checked',
      },
      error: null,
    },
    {
      status: 200,
      headers: {
        // Do not cache health responses — monitors need fresh data
        'Cache-Control': 'no-store',
      },
    },
  );
}
