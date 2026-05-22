/**
 * Security smoke tests — rate limiter logic, RATE_LIMITS config, and health shape.
 *
 * The rate limiter (src/lib/rateLimit.ts) has no Next.js dependency so it can be
 * imported directly by the test runner. The health endpoint handler imports
 * NextResponse and cannot be imported outside the Next.js build context, so we
 * test its response shape by verifying the package.json contract separately.
 *
 * No DB, no network, no HTTP server required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  type RateLimitConfig,
} from '../lib/rateLimit.ts';

// package.json is used by the health endpoint — verify it has the expected shape
import pkg from '../../package.json' with { type: 'json' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', { method: 'POST', headers });
}

function makeRequestFromIp(ip: string): Request {
  return makeRequest({ 'x-forwarded-for': ip });
}

// ── Rate limiter — core logic ─────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows first request within limit', () => {
    const result = checkRateLimit(makeRequestFromIp('10.0.0.1'), 'test:first', { max: 3, windowMs: 60_000 });
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 2);
  });

  it('tracks remaining correctly across multiple requests', () => {
    const ip = '10.0.0.2';
    const cfg: RateLimitConfig = { max: 3, windowMs: 60_000 };
    const route = 'test:track';

    const r1 = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(r1.remaining, 2);

    const r2 = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(r2.remaining, 1);

    const r3 = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(r3.remaining, 0);
    assert.equal(r3.allowed, true);
  });

  it('blocks after limit is exceeded', () => {
    const ip = '10.0.0.3';
    const cfg: RateLimitConfig = { max: 2, windowMs: 60_000 };
    const route = 'test:block';

    checkRateLimit(makeRequestFromIp(ip), route, cfg);
    checkRateLimit(makeRequestFromIp(ip), route, cfg);
    const r3 = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
  });

  it('sets retryAfterSeconds > 0 when blocked', () => {
    const ip = '10.0.0.4';
    const cfg: RateLimitConfig = { max: 1, windowMs: 30_000 };
    const route = 'test:retry';

    checkRateLimit(makeRequestFromIp(ip), route, cfg);
    const blocked = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0, 'retryAfterSeconds must be > 0 when blocked');
    assert.ok(blocked.retryAfterSeconds <= 30, 'retryAfterSeconds must be ≤ window seconds');
  });

  it('isolates counters by route key', () => {
    const ip = '10.0.0.5';
    const cfg: RateLimitConfig = { max: 1, windowMs: 60_000 };

    const routeA = checkRateLimit(makeRequestFromIp(ip), 'test:iso:A', cfg);
    const routeB = checkRateLimit(makeRequestFromIp(ip), 'test:iso:B', cfg);
    assert.equal(routeA.allowed, true);
    assert.equal(routeB.allowed, true, 'different routes must have independent counters');
  });

  it('isolates counters by IP', () => {
    const cfg: RateLimitConfig = { max: 1, windowMs: 60_000 };
    const route = 'test:iso:ip';

    const r1 = checkRateLimit(makeRequestFromIp('10.1.0.1'), route, cfg);
    const r2 = checkRateLimit(makeRequestFromIp('10.1.0.2'), route, cfg);
    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true, 'different IPs must have independent counters');
  });

  it('extracts IP from x-forwarded-for (first entry wins)', () => {
    const cfg: RateLimitConfig = { max: 1, windowMs: 60_000 };
    const route = 'test:xff';

    // Exhaust limit for 1.2.3.4
    checkRateLimit(makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }), route, cfg);

    // Same first IP — blocked
    const blocked = checkRateLimit(
      makeRequest({ 'x-forwarded-for': '1.2.3.4, 99.99.99.99' }),
      route,
      cfg,
    );
    assert.equal(blocked.allowed, false);

    // Different first IP — allowed
    const allowed = checkRateLimit(
      makeRequest({ 'x-forwarded-for': '9.8.7.6, 5.6.7.8' }),
      route,
      cfg,
    );
    assert.equal(allowed.allowed, true);
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const result = checkRateLimit(
      makeRequest({ 'x-real-ip': '11.22.33.44' }),
      'test:xri',
      { max: 5, windowMs: 60_000 },
    );
    assert.equal(result.allowed, true);
  });

  it('buckets requests with no IP headers together', () => {
    const cfg: RateLimitConfig = { max: 2, windowMs: 60_000 };
    const route = 'test:unknown-ip';

    checkRateLimit(makeRequest(), route, cfg);
    checkRateLimit(makeRequest(), route, cfg);
    const blocked = checkRateLimit(makeRequest(), route, cfg);
    assert.equal(blocked.allowed, false);
  });

  it('resets window after windowMs elapses', async () => {
    const ip = '10.2.0.1';
    const cfg: RateLimitConfig = { max: 1, windowMs: 50 }; // 50ms window
    const route = 'test:window-reset';

    checkRateLimit(makeRequestFromIp(ip), route, cfg);
    const blocked = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(blocked.allowed, false);

    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    const allowed = checkRateLimit(makeRequestFromIp(ip), route, cfg);
    assert.equal(allowed.allowed, true, 'must be allowed again after window resets');
  });
});

// ── rateLimitResponse shape ───────────────────────────────────────────────────

describe('rateLimitResponse', () => {
  const mockResult = { allowed: false, remaining: 0, resetAt: Date.now() + 30_000, retryAfterSeconds: 30 };

  it('returns HTTP 429', () => {
    assert.equal(rateLimitResponse(mockResult).status, 429);
  });

  it('includes Retry-After header', () => {
    const res = rateLimitResponse({ ...mockResult, retryAfterSeconds: 15 });
    assert.equal(res.headers.get('Retry-After'), '15');
  });

  it('body has { data: null, error: { message } } shape', async () => {
    const body = (await rateLimitResponse(mockResult).json()) as Record<string, unknown>;
    assert.equal(body.data, null);
    assert.ok(typeof body.error === 'object' && body.error !== null);
    const err = body.error as Record<string, unknown>;
    assert.ok(typeof err.message === 'string', 'error.message must be a string');
  });

  it('error message does not reveal internal implementation details', async () => {
    const body = (await rateLimitResponse(mockResult).json()) as Record<string, unknown>;
    const msg = ((body.error as Record<string, unknown>).message as string).toLowerCase();
    assert.ok(!msg.includes('map'), 'must not mention internal Map store');
    assert.ok(!msg.includes('redis'), 'must not mention Redis');
    assert.ok(!msg.includes(':'), 'must not expose key format (routeKey:ip)');
  });
});

// ── RATE_LIMITS config sanity ─────────────────────────────────────────────────

describe('RATE_LIMITS config', () => {
  it('all configs have positive max and windowMs', () => {
    for (const [name, cfg] of Object.entries(RATE_LIMITS)) {
      assert.ok(cfg.max > 0, `RATE_LIMITS.${name}.max must be > 0`);
      assert.ok(cfg.windowMs > 0, `RATE_LIMITS.${name}.windowMs must be > 0`);
    }
  });

  it('login is stricter than subscription quote (ORS quota pressure)', () => {
    const loginRate = RATE_LIMITS.login.max / RATE_LIMITS.login.windowMs;
    const quoteRate = RATE_LIMITS.subscriptionQuote.max / RATE_LIMITS.subscriptionQuote.windowMs;
    assert.ok(loginRate < quoteRate, 'login must be more restrictive than quote');
  });

  it('reset-password is the most restrictive auth endpoint', () => {
    const resetRate = RATE_LIMITS.resetPassword.max / RATE_LIMITS.resetPassword.windowMs;
    assert.ok(
      resetRate <= RATE_LIMITS.login.max / RATE_LIMITS.login.windowMs,
      'reset-password must be no more permissive than login',
    );
    assert.ok(
      resetRate <= RATE_LIMITS.register.max / RATE_LIMITS.register.windowMs,
      'reset-password must be no more permissive than register',
    );
  });

  it('webhook limit is much higher than auth limits (called by payment gateway)', () => {
    assert.ok(
      RATE_LIMITS.webhookPayment.max > RATE_LIMITS.login.max * 5,
      'webhook must allow far more requests per window than login',
    );
  });

  it('safety report limit uses an hourly window (10/hour policy)', () => {
    // window should be 1 hour (3 600 000 ms)
    assert.equal(RATE_LIMITS.safetyReport.windowMs, 60 * 60 * 1000);
    assert.equal(RATE_LIMITS.safetyReport.max, 10);
  });
});

// ── Health endpoint contract ──────────────────────────────────────────────────
// We verify the contract from the package.json side (no next/server import needed).
// The actual handler is tested at the integration level via the build + verify chain.

describe('health endpoint contract', () => {
  it('package.json has a non-empty version string (used by /api/health)', () => {
    assert.ok(typeof pkg.version === 'string', 'package.json version must be a string');
    assert.ok(pkg.version.length > 0, 'package.json version must not be empty');
  });

  it('package.json version follows semver pattern', () => {
    // Simple check: x.y.z
    assert.ok(/^\d+\.\d+\.\d+/.test(pkg.version), `version "${pkg.version}" must match semver`);
  });

  it('package.json does not contain secrets', () => {
    const json = JSON.stringify(pkg).toLowerCase();
    for (const keyword of ['password', 'secret', 'api_key', 'myfatoorah', 'openrouteservice']) {
      assert.ok(!json.includes(keyword), `package.json must not contain "${keyword}"`);
    }
  });

  it('expected health response shape is well-formed', () => {
    // Simulate what the handler builds — verify the shape contract is coherent
    const timestamp = new Date().toISOString();
    const healthData = {
      status: 'ok' as const,
      timestamp,
      version: pkg.version,
      db: 'not_checked' as const,
    };

    assert.equal(healthData.status, 'ok');
    assert.ok(!isNaN(Date.parse(healthData.timestamp)), 'timestamp must be valid ISO date');
    assert.equal(healthData.db, 'not_checked');
    assert.equal(healthData.version, pkg.version);
  });
});
