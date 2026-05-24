import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';

/** Verify cron secret header or fall back to admin session. */
export async function verifyCronOrAdmin(req: Request): Promise<
  { ok: true; userId: string | null; source: 'CRON' | 'ADMIN' } | { ok: false; response: NextResponse }
> {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get('authorization');
  if (secret && authHeader === `Bearer ${secret}`) {
    return { ok: true, userId: null, source: 'CRON' };
  }

  const auth = await requireRole(['ADMIN']);
  if (auth instanceof NextResponse) {
    if (!secret) {
      return {
        ok: false,
        response: NextResponse.json(
          { data: null, error: { message: 'Unauthorized — set CRON_SECRET or use admin session' } },
          { status: 401 },
        ),
      };
    }
    return { ok: false, response: auth };
  }

  return { ok: true, userId: auth.userId, source: 'ADMIN' };
}
