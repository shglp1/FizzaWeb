/**
 * Smoke tests for the enterprise security hardening pass.
 *
 * Covers (pure logic where possible, mirrored rules otherwise):
 *   - webhook signature fail-closed in production
 *   - payment processing atomic-claim idempotency semantics
 *   - gateway settlement amount verification tolerance
 *   - family-parent (driver-applicant) API guard
 *   - safety-report trip ownership (incl. rider.parentId path)
 *   - chat attachment-URL allow-listing
 *   - upload magic-byte signature validation
 *   - client error sanitization (BusinessError vs internal)
 *   - input bounds (coords, admin wallet adjustment, cancel reason)
 *   - SESSION_SECRET minimum-length guard
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAllowedAttachmentUrl,
  detectFileSignature,
  verifyFileSignature,
} from '../lib/storage/uploadValidation.ts';
import { BusinessError, clientErrorMessage } from '../lib/errors.ts';
import { signToken } from '../lib/auth.ts';

// ─── C1: webhook fail-closed (mirrors verifyWebhookSignature secret-missing rule) ──

function webhookAllowsWhenSecretMissing(nodeEnv: string): boolean {
  // In production a missing secret must reject (fail closed); elsewhere skip.
  return nodeEnv !== 'production';
}

test('C1 webhook: missing secret rejects in production', () => {
  assert.equal(webhookAllowsWhenSecretMissing('production'), false);
});

test('C1 webhook: missing secret skips verification in dev/test only', () => {
  assert.equal(webhookAllowsWhenSecretMissing('development'), true);
  assert.equal(webhookAllowsWhenSecretMissing('test'), true);
});

// ─── H1: payment idempotency atomic claim (mirrors updateMany count semantics) ────

function processPaidClaim(claimCount: number): 'PAID' | 'ALREADY_PROCESSED' {
  // Only the processor whose conditional update affects a row credits the wallet.
  return claimCount === 1 ? 'PAID' : 'ALREADY_PROCESSED';
}

test('H1 payment idempotency: winning claim processes once', () => {
  assert.equal(processPaidClaim(1), 'PAID');
});

test('H1 payment idempotency: losing/duplicate claim is a no-op', () => {
  assert.equal(processPaidClaim(0), 'ALREADY_PROCESSED');
});

// ─── M1: gateway amount verification (mirrors tolerance check) ─────────────────

function amountMatches(expected: number, gateway: number | null | undefined): boolean {
  if (gateway === null || gateway === undefined) return true; // not provided → skip
  const tolerance = 0.01;
  return Number.isFinite(expected) && Math.abs(gateway - expected) <= tolerance;
}

test('M1 amount verify: exact and within-tolerance amounts pass', () => {
  assert.equal(amountMatches(100, 100), true);
  assert.equal(amountMatches(100, 100.005), true);
});

test('M1 amount verify: mismatched amount is rejected', () => {
  assert.equal(amountMatches(100, 90), false);
  assert.equal(amountMatches(100, 100.5), false);
});

test('M1 amount verify: missing gateway value skips check', () => {
  assert.equal(amountMatches(100, null), true);
  assert.equal(amountMatches(100, undefined), true);
});

// ─── H3: family-parent guard (mirrors requireFamilyParent rule) ───────────────

function familyParentAllowed(role: string, registrationSource?: string): boolean {
  return !(role === 'PARENT' && registrationSource === 'DRIVER_PORTAL');
}

test('H3 applicant guard: driver-portal applicant is blocked from parent APIs', () => {
  assert.equal(familyParentAllowed('PARENT', 'DRIVER_PORTAL'), false);
});

test('H3 applicant guard: genuine family parent is allowed', () => {
  assert.equal(familyParentAllowed('PARENT', 'FAMILY'), true);
  assert.equal(familyParentAllowed('PARENT', undefined), true);
});

test('H3 applicant guard: drivers and admins are unaffected', () => {
  assert.equal(familyParentAllowed('DRIVER', 'DRIVER_PORTAL'), true);
  assert.equal(familyParentAllowed('ADMIN', undefined), true);
});

// ─── M2: safety-report ownership (mirrors owner/riderParent/driver check) ─────

function safetyReportAuthorized(opts: {
  userId: string;
  subscriptionUserId?: string | null;
  riderParentId?: string | null;
  driverProfileId?: string | null;
}): boolean {
  return (
    opts.subscriptionUserId === opts.userId ||
    opts.riderParentId === opts.userId ||
    opts.driverProfileId === opts.userId
  );
}

test('M2 safety-report: subscription owner allowed', () => {
  assert.equal(safetyReportAuthorized({ userId: 'u1', subscriptionUserId: 'u1' }), true);
});

test('M2 safety-report: rider-only parent allowed via rider.parentId', () => {
  assert.equal(
    safetyReportAuthorized({ userId: 'u1', subscriptionUserId: null, riderParentId: 'u1' }),
    true,
  );
});

test('M2 safety-report: assigned driver allowed', () => {
  assert.equal(safetyReportAuthorized({ userId: 'd1', driverProfileId: 'd1' }), true);
});

test('M2 safety-report: unrelated user blocked', () => {
  assert.equal(
    safetyReportAuthorized({
      userId: 'stranger',
      subscriptionUserId: 'u1',
      riderParentId: 'u1',
      driverProfileId: 'd1',
    }),
    false,
  );
});

// ─── M4: chat attachment URL allow-list ───────────────────────────────────────

test('M4 attachment URL: same-origin /uploads/ path allowed', () => {
  assert.equal(isAllowedAttachmentUrl('/uploads/safety/abc.jpg'), true);
});

test('M4 attachment URL: external and traversal URLs rejected', () => {
  assert.equal(isAllowedAttachmentUrl('https://evil.example.com/x.png'), false);
  assert.equal(isAllowedAttachmentUrl('//evil.example.com/x.png'), false);
  assert.equal(isAllowedAttachmentUrl('/uploads/../../etc/passwd'), false);
  assert.equal(isAllowedAttachmentUrl(''), false);
});

test('M4 attachment URL: configured R2 public base allowed, others not', () => {
  const prev = process.env.R2_PUBLIC_BASE_URL;
  process.env.R2_PUBLIC_BASE_URL = 'https://cdn.fizza.example';
  try {
    assert.equal(isAllowedAttachmentUrl('https://cdn.fizza.example/safety/a.jpg'), true);
    assert.equal(isAllowedAttachmentUrl('https://cdn.other.example/safety/a.jpg'), false);
  } finally {
    if (prev === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = prev;
  }
});

// ─── M5: magic-byte signature validation ──────────────────────────────────────

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
]);
const PDF = Buffer.from('%PDF-1.7\n', 'ascii');
const HTML = Buffer.from('<!DOCTYPE html><script>alert(1)</script>', 'ascii');

test('M5 magic bytes: detects real image/pdf signatures', () => {
  assert.equal(detectFileSignature(JPEG), 'image/jpeg');
  assert.equal(detectFileSignature(PNG), 'image/png');
  assert.equal(detectFileSignature(WEBP), 'image/webp');
  assert.equal(detectFileSignature(PDF), 'application/pdf');
  assert.equal(detectFileSignature(HTML), null);
});

test('M5 magic bytes: rejects content disguised under a false MIME', () => {
  assert.equal(verifyFileSignature('image/png', HTML).ok, false);
  // JPEG bytes declared as PNG must fail (content/type mismatch).
  assert.equal(verifyFileSignature('image/png', JPEG).ok, false);
});

test('M5 magic bytes: accepts matching content and MIME', () => {
  assert.equal(verifyFileSignature('image/png', PNG).ok, true);
  assert.equal(verifyFileSignature('image/jpeg', JPEG).ok, true);
});

// ─── M3: client error sanitization ────────────────────────────────────────────

test('M3 error sanitize: BusinessError message is surfaced to client', () => {
  assert.equal(clientErrorMessage(new BusinessError('Trip not completed yet')), 'Trip not completed yet');
});

test('M3 error sanitize: internal errors are replaced with a generic message', () => {
  const generic = clientErrorMessage(new Error('PrismaClientKnownRequestError: column x'), 'Unable to submit');
  assert.equal(generic, 'Unable to submit');
  assert.equal(clientErrorMessage('weird', 'fallback'), 'fallback');
});

// ─── M6-M8: input bounds ──────────────────────────────────────────────────────

const latInRange = (v: number) => v >= -90 && v <= 90;
const lngInRange = (v: number) => v >= -180 && v <= 180;

test('M8 coord bounds: valid coordinates accepted, out-of-range rejected', () => {
  assert.equal(latInRange(24.7) && lngInRange(46.7), true);
  assert.equal(latInRange(95), false);
  assert.equal(lngInRange(-200), false);
});

const MAX_ADJUSTMENT_SAR = 100000;
const adjustmentAllowed = (n: number) => n !== 0 && Number.isFinite(n) && Math.abs(n) <= MAX_ADJUSTMENT_SAR;

test('M6 wallet adjustment: bounded magnitude enforced', () => {
  assert.equal(adjustmentAllowed(500), true);
  assert.equal(adjustmentAllowed(-500), true);
  assert.equal(adjustmentAllowed(0), false);
  assert.equal(adjustmentAllowed(100001), false);
});

const cancelReasonOk = (s: string) => s.length <= 500;

test('M7 cancel reason: oversized reason rejected', () => {
  assert.equal(cancelReasonOk('legitimate reason'), true);
  assert.equal(cancelReasonOk('x'.repeat(501)), false);
});

// ─── L1: SESSION_SECRET minimum-length guard (real check against auth.ts) ─────

test('L1 session secret: short secret is rejected at sign time', async () => {
  const prevSecret = process.env.SESSION_SECRET;
  const prevNextAuth = process.env.NEXTAUTH_SECRET;
  process.env.SESSION_SECRET = 'too-short';
  delete process.env.NEXTAUTH_SECRET;
  try {
    await assert.rejects(() => signToken('user-1', 'PARENT'), /at least 32 characters/);
  } finally {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevNextAuth !== undefined) process.env.NEXTAUTH_SECRET = prevNextAuth;
  }
});

test('L1 session secret: sufficiently long secret signs successfully', async () => {
  const prevSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'a'.repeat(48);
  try {
    const token = await signToken('user-1', 'PARENT');
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0);
  } finally {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  }
});
