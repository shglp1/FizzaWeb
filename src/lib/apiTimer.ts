/**
 * Lightweight API response-time instrumentation.
 *
 * Wraps a route handler so every response carries an `X-Response-Time` header
 * (milliseconds). This is the baseline data source for performance benchmarking
 * and lets k6 / browser devtools attribute latency without app-level changes.
 *
 * Usage:
 *   export const GET = withTiming(async (req) => { ... return NextResponse.json(...) });
 *
 * Notes:
 * - Purely additive: it never alters status codes or bodies.
 * - Safe on all deployments (no shared state, no DB).
 * - Optionally logs slow requests when LOG_SLOW_REQUESTS=true.
 */
import { NextResponse } from 'next/server';

const SLOW_REQUEST_THRESHOLD_MS = Number(
  process.env.SLOW_REQUEST_THRESHOLD_MS ?? 500,
);

type RouteHandler<Ctx> = (
  req: Request,
  ctx: Ctx,
) => Promise<Response> | Response;

export function withTiming<Ctx = unknown>(
  handler: RouteHandler<Ctx>,
  label?: string,
): RouteHandler<Ctx> {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const start = Date.now();
    let res: Response;
    try {
      res = await handler(req, ctx);
    } catch (err) {
      const durationMs = Date.now() - start;
      // Re-throw after timing so error handling upstream is preserved.
      if (process.env.LOG_SLOW_REQUESTS === 'true') {
        // eslint-disable-next-line no-console
        console.warn(`[API ${label ?? 'route'}] errored after ${durationMs}ms`);
      }
      throw err;
    }

    const durationMs = Date.now() - start;

    // Clone headers so we can append without mutating an immutable Headers
    // instance returned by some Response constructors.
    const headers = new Headers(res.headers);
    headers.set('X-Response-Time', `${durationMs}ms`);

    if (
      process.env.LOG_SLOW_REQUESTS === 'true' &&
      durationMs >= SLOW_REQUEST_THRESHOLD_MS
    ) {
      // eslint-disable-next-line no-console
      console.warn(`[SLOW API ${label ?? 'route'}] ${durationMs}ms`);
    }

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}
