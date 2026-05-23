/**
 * Auth smoke tests — run with: npm test
 * Uses Node.js built-in test runner (Node 18+). No database required.
 * Tests cover the JWT sign/verify layer and session helper logic.
 */

// Set required env var before any auth function is called (getSecret reads it lazily)
process.env.SESSION_SECRET = 'smoke-test-secret-minimum-32-characters-long!!';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, SESSION_COOKIE, SESSION_MAX_AGE } from '../lib/auth.ts';

describe('signToken / verifyToken', () => {
  it('signs and verifies a valid token', async () => {
    const token = await signToken('user-123', 'PARENT');
    assert.ok(typeof token === 'string' && token.length > 0, 'token is a non-empty string');

    const payload = await verifyToken(token);
    assert.ok(payload !== null, 'payload is not null');
    assert.equal(payload!.userId, 'user-123');
    assert.equal(payload!.role, 'PARENT');
  });

  it('signs a token with ADMIN role and verifies role', async () => {
    const token = await signToken('admin-456', 'ADMIN');
    const payload = await verifyToken(token);
    assert.equal(payload!.role, 'ADMIN');
  });

  it('returns null for a tampered token', async () => {
    const token = await signToken('user-789', 'PARENT');
    // Split into header.payload.signature
    const [header, payloadB64, signature] = token.split('.') as [string, string, string];

    // Decode, mutate the payload, re-encode — keeps original signature
    // jose verifies HMAC(header.payload) === signature, so any payload change breaks it
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>;
    decoded['role'] = decoded['role'] === 'ADMIN' ? 'PARENT' : 'ADMIN'; // flip role
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const tampered = [header, tamperedPayloadB64, signature].join('.');
    const result = await verifyToken(tampered);
    assert.equal(result, null, 'token with tampered payload but original signature must return null');
  });

  it('returns null for an arbitrary string', async () => {
    const payload = await verifyToken('not.a.jwt');
    assert.equal(payload, null);
  });

  it('exports correct cookie name constant', () => {
    assert.equal(SESSION_COOKIE, 'fizza-session');
  });

  it('exports session max age of 30 days in seconds', () => {
    assert.equal(SESSION_MAX_AGE, 30 * 24 * 60 * 60);
  });
});

describe('role-based access logic', () => {
  it('ADMIN role token grants admin access', async () => {
    const token = await signToken('admin-user', 'ADMIN');
    const session = await verifyToken(token);
    assert.equal(session!.role === 'ADMIN', true);
  });

  it('PARENT role token does not grant admin access', async () => {
    const token = await signToken('parent-user', 'PARENT');
    const session = await verifyToken(token);
    assert.equal(session!.role === 'ADMIN', false);
  });

  it('a forged plain-cookie role value cannot bypass JWT verification', async () => {
    const fakeToken = 'this-is-not-a-real-jwt';
    const session = await verifyToken(fakeToken);
    assert.equal(session, null, 'no session from fake token — role in plain cookie is irrelevant');
  });
});
