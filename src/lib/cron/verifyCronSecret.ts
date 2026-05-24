import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from './cronAuth';

/** Cron endpoints must present Authorization: Bearer CRON_SECRET. No admin fallback. */
export function verifyCronSecret(req: Request): { ok: true } | { ok: false; response: NextResponse } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { data: null, error: { message: 'CRON_SECRET is not configured on the server' } },
        { status: 503 },
      ),
    };
  }

  if (!isAuthorizedCronRequest(req.headers.get('authorization'), secret)) {
    return {
      ok: false,
      response: NextResponse.json(
        { data: null, error: { message: 'Unauthorized' } },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}
