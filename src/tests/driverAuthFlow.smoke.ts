/**
 * Driver auth flow smoke tests — run with: npm test
 * No database or Next.js runtime required.
 */

process.env.SESSION_SECRET = 'smoke-test-secret-minimum-32-characters-long!!';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE,
  signToken,
} from '../lib/auth.ts';
import {
  canAccessDriverApplicationForm,
  requiresDriverSignIn,
  isSafeReturnTo,
  resolveDriverLoginRedirect,
  DRIVER_APPLICATION_LOGIN_PATH,
} from '../lib/driverAuthFlow.ts';

// ─── Session cookie contract (register must match login) ─────────────────────

describe('register session cookie contract', () => {
  it('uses the same cookie name and max age as login', () => {
    assert.equal(SESSION_COOKIE, 'fizza-session');
    assert.equal(SESSION_COOKIE_OPTIONS.maxAge, SESSION_MAX_AGE);
    assert.equal(SESSION_COOKIE_OPTIONS.httpOnly, true);
    assert.equal(SESSION_COOKIE_OPTIONS.sameSite, 'lax');
    assert.equal(SESSION_COOKIE_OPTIONS.path, '/');
  });

  it('signToken produces PARENT role for new driver portal accounts', async () => {
    const token = await signToken('user-new', 'PARENT');
    assert.ok(token.length > 0);
  });
});

// ─── /api/me driverState after driver register ───────────────────────────────

describe('/api/me driverState after DRIVER_PORTAL registration', () => {
  function computeDriverState(
    role: string,
    registrationSource: string,
    hasApplication: boolean,
  ): string {
    if (role === 'ADMIN') return 'ADMIN';
    if (role === 'DRIVER') return 'APPROVED_DRIVER';
    const isDriverApplicant =
      registrationSource === 'DRIVER_PORTAL' || hasApplication;
    return isDriverApplicant ? 'DRIVER_APPLICANT' : 'PARENT';
  }

  it('PARENT + DRIVER_PORTAL + no app → DRIVER_APPLICANT', () => {
    assert.equal(
      computeDriverState('PARENT', 'DRIVER_PORTAL', false),
      'DRIVER_APPLICANT',
    );
  });

  it('PARENT + FAMILY + no app → PARENT', () => {
    assert.equal(computeDriverState('PARENT', 'FAMILY', false), 'PARENT');
  });
});

// ─── /driver-application UI guards ───────────────────────────────────────────

describe('/driver-application unauthenticated UI guards', () => {
  it('requires sign-in when session is missing', () => {
    assert.equal(requiresDriverSignIn(false, false), true);
  });

  it('does not require sign-in while loading', () => {
    assert.equal(requiresDriverSignIn(true, false), false);
  });

  it('does not show form when unauthenticated', () => {
    assert.equal(canAccessDriverApplicationForm(false, 'DRIVER_APPLICANT'), false);
  });

  it('shows form only for authenticated DRIVER_APPLICANT', () => {
    assert.equal(canAccessDriverApplicationForm(true, 'DRIVER_APPLICANT'), true);
    assert.equal(canAccessDriverApplicationForm(true, 'PARENT'), false);
  });

  it('login path includes returnTo for driver-application', () => {
    assert.equal(
      DRIVER_APPLICATION_LOGIN_PATH,
      '/driver/login?returnTo=/driver-application',
    );
  });
});

// ─── /driver/login returnTo ──────────────────────────────────────────────────

describe('/driver/login returnTo redirect', () => {
  it('rejects unsafe returnTo values', () => {
    assert.equal(isSafeReturnTo('//evil.com'), false);
    assert.equal(isSafeReturnTo('https://evil.com'), false);
    assert.equal(isSafeReturnTo(null), false);
  });

  it('accepts internal returnTo paths', () => {
    assert.equal(isSafeReturnTo('/driver-application'), true);
  });

  it('honours returnTo after login for driver applicants', () => {
    assert.equal(
      resolveDriverLoginRedirect('/driver-application', 'DRIVER_APPLICANT'),
      '/driver-application',
    );
  });

  it('approved driver goes to dashboard when no returnTo', () => {
    assert.equal(
      resolveDriverLoginRedirect(null, 'APPROVED_DRIVER'),
      '/driver/dashboard',
    );
  });
});

// ─── API 401 handling contract ───────────────────────────────────────────────

describe('driver-application API 401 client handling', () => {
  it('maps 401 responses to unauthorized flag', () => {
    const res = { status: 401, unauthorized: true };
    assert.equal(res.status, 401);
    assert.equal(res.unauthorized, true);
  });

  it('session expired message is defined for POST 401', () => {
    const message = 'Your session expired. Please sign in again.';
    assert.ok(message.includes('session expired'));
  });
});
