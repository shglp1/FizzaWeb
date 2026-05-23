/**
 * In-process rate limiter for Next.js App Router route handlers.
 *
 * ⚠️  IMPORTANT — Production Multi-Instance Limitation
 * ─────────────────────────────────────────────────────
 * This implementation uses a module-level Map. In a single Vercel function instance
 * (while it stays warm) this works correctly. But Vercel auto-scales across many
 * instances — each with its own Map — so a determined attacker can bypass limits
 * by hitting different instances.
 *
 * For real multi-instance production rate limiting replace `InMemoryStore` below
 * with an Upstash Redis client using `SET key NX PX windowMs` + INCR. Example:
 *   https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 *
 * The public API (checkRateLimit / RATE_LIMITS / rateLimitResponse) is
 * designed to be a drop-in replacement — swap the store without touching routes.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether this request is within the limit. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds until the window resets (only meaningful when !allowed). */
  retryAfterSeconds: number;
}

// ── In-process store ──────────────────────────────────────────────────────────

interface StoreEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, StoreEntry>();

// Cleanup expired entries every 500 requests to prevent unbounded growth.
// This is a best-effort GC — not latency-sensitive.
let requestsUntilCleanup = 500;

function maybeCleanup(): void {
  requestsUntilCleanup -= 1;
  if (requestsUntilCleanup > 0) return;
  requestsUntilCleanup = 500;
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

// ── IP extraction ─────────────────────────────────────────────────────────────

/**
 * Extract the client IP from a request.
 * Vercel sets `x-forwarded-for`; the first entry is the real client IP.
 * Falls back to `x-real-ip`, then 'unknown'.
 */
function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

// ── Core check ────────────────────────────────────────────────────────────────

/**
 * Check and increment the rate limit counter for a given request.
 *
 * @param req       The incoming Request (or NextRequest).
 * @param routeKey  A stable string identifying the route (e.g. 'auth:login').
 * @param config    Max requests and window duration.
 */
export function checkRateLimit(
  req: Request,
  routeKey: string,
  config: RateLimitConfig,
): RateLimitResult {
  maybeCleanup();

  const ip = getClientIp(req);
  const key = `${routeKey}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(key, entry);
  }

  entry.count += 1;

  const allowed = entry.count <= config.max;
  const remaining = Math.max(0, config.max - entry.count);
  const retryAfterSeconds = allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000);

  return { allowed, remaining, resetAt: entry.resetAt, retryAfterSeconds };
}

// ── 429 response helper ───────────────────────────────────────────────────────

/**
 * Build a standardised 429 Response with rate-limit headers.
 * Returns a plain Web API Response (no Next.js dep) — Next.js App Router
 * accepts both Response and NextResponse as handler return values.
 * Does not leak internal implementation details.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ data: null, error: { message: 'Too many requests. Please try again later.' } }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

// ── Per-route configs ─────────────────────────────────────────────────────────

/**
 * Canonical rate limit configs for all protected endpoints.
 * Adjust values here — no need to touch route files.
 */
export const RATE_LIMITS = {
  /** 5 login attempts per 5 minutes per IP. */
  login: { max: 5, windowMs: 5 * 60 * 1000 } satisfies RateLimitConfig,

  /** 5 register attempts per 10 minutes per IP. */
  register: { max: 5, windowMs: 10 * 60 * 1000 } satisfies RateLimitConfig,

  /** 3 password reset attempts per 10 minutes per IP. */
  resetPassword: { max: 3, windowMs: 10 * 60 * 1000 } satisfies RateLimitConfig,

  /**
   * 10 payment initiations per minute per IP.
   * Real protection is MyFatoorah-side; this guards against runaway clients.
   */
  paymentCreate: { max: 10, windowMs: 60 * 1000 } satisfies RateLimitConfig,

  /**
   * 200 webhook calls per minute.
   * The primary defence on the webhook is HMAC signature verification.
   * This limit guards against trivial DoS from non-MyFatoorah sources.
   */
  webhookPayment: { max: 200, windowMs: 60 * 1000 } satisfies RateLimitConfig,

  /**
   * 20 quote requests per minute per IP.
   * Each quote calls OpenRouteService — quota is ~2000/day on free tier.
   */
  subscriptionQuote: { max: 20, windowMs: 60 * 1000 } satisfies RateLimitConfig,

  /**
   * 60 geocode/location searches per minute per IP.
   * Each keystroke (debounced at 350ms) triggers one search — generous limit
   * to avoid blocking legitimate autocomplete usage.
   */
  geocode: { max: 60, windowMs: 60 * 1000 } satisfies RateLimitConfig,

  /**
   * 30 payment callback/verify calls per minute per IP.
   * Browser redirects and manual Verify-Payment taps share this limit.
   */
  paymentCallback: { max: 30, windowMs: 60 * 1000 } satisfies RateLimitConfig,

  /** 10 safety reports per hour per IP. */
  safetyReport: { max: 10, windowMs: 60 * 60 * 1000 } satisfies RateLimitConfig,
} as const;
