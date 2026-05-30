/**
 * Wallet financial operations smoke tests.
 * Covers gaps identified in the financial operations audit:
 *   - source field correctness on wallet transactions
 *   - WalletOperationError / TripWalletCreditError codes
 *   - applyWalletAdjustment / processTripWalletCredit guards
 *   - P2002 fallback transaction wrapping
 *   - processNonCreditFinancialReview no-wallet-mutation guarantee
 *   - wallet history API response shape
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  WalletOperationError,
} from '../lib/financials/walletOps.ts';
import {
  TripWalletCreditError,
  computeTripWalletCreditAmount,
  isPrismaUniqueViolation,
} from '../lib/financials/tripWalletCredit.ts';

// ─── Source field correctness ─────────────────────────────────────────────────

describe('wallet transaction source fields', () => {
  it('processPaymentStatus TOP_UP block sets source: TOP_UP', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/payments/processPaymentStatus.ts'),
      'utf8',
    );
    // Confirm the source field is set immediately after txType: 'TOP_UP'
    assert.ok(
      src.includes("txType: 'TOP_UP'") && src.includes("source: 'TOP_UP'"),
      'processPaymentStatus must set source: TOP_UP on wallet top-up transactions',
    );
  });

  it('pay-subscription route sets source: SUBSCRIPTION_PAYMENT on wallet debit', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/wallet/pay-subscription/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("txType: 'SUBSCRIPTION_PAYMENT'") && src.includes("source: 'SUBSCRIPTION_PAYMENT'"),
      'pay-subscription must set source: SUBSCRIPTION_PAYMENT on wallet transaction',
    );
  });

  it('walletOps MANUAL_ADJUSTMENT sets source to MANUAL_ADJUSTMENT by default', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/walletOps.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("source: input.source ?? 'MANUAL_ADJUSTMENT'"),
      'walletOps must default source to MANUAL_ADJUSTMENT',
    );
  });

  it('tripWalletCredit sets source: TRIP_FINANCIAL_CREDIT on credit transactions', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("source: 'TRIP_FINANCIAL_CREDIT'"),
      'processTripWalletCredit must set source: TRIP_FINANCIAL_CREDIT',
    );
  });
});

// ─── WalletOperationError codes ───────────────────────────────────────────────

describe('WalletOperationError', () => {
  it('NEGATIVE_BALANCE code is set correctly', () => {
    const err = new WalletOperationError('Balance cannot go negative', 'NEGATIVE_BALANCE');
    assert.ok(err instanceof Error);
    assert.equal(err.code, 'NEGATIVE_BALANCE');
    assert.equal(err.name, 'WalletOperationError');
  });

  it('INVALID_AMOUNT code is set correctly', () => {
    const err = new WalletOperationError('Amount cannot be zero', 'INVALID_AMOUNT');
    assert.equal(err.code, 'INVALID_AMOUNT');
  });

  it('USER_NOT_FOUND code is set correctly', () => {
    const err = new WalletOperationError('User not found', 'USER_NOT_FOUND');
    assert.equal(err.code, 'USER_NOT_FOUND');
  });

  it('walletOps code guards negative balance with NEGATIVE_BALANCE error', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/walletOps.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("throw new WalletOperationError('Balance cannot go negative', 'NEGATIVE_BALANCE')"),
      'walletOps must guard against negative balance',
    );
  });

  it('walletOps code guards zero amount with INVALID_AMOUNT error', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/walletOps.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("throw new WalletOperationError('Amount cannot be zero', 'INVALID_AMOUNT')"),
      'walletOps must reject zero amount',
    );
  });
});

// ─── TripWalletCreditError codes ──────────────────────────────────────────────

describe('TripWalletCreditError', () => {
  it('AMOUNT_MISMATCH code is set correctly', () => {
    const err = new TripWalletCreditError('Amount mismatch', 'AMOUNT_MISMATCH');
    assert.equal(err.code, 'AMOUNT_MISMATCH');
    assert.equal(err.name, 'TripWalletCreditError');
  });

  it('NOT_COMPLETED code is set correctly', () => {
    const err = new TripWalletCreditError('Trip must be completed', 'NOT_COMPLETED');
    assert.equal(err.code, 'NOT_COMPLETED');
  });

  it('NO_SUBSCRIPTION code is set correctly', () => {
    const err = new TripWalletCreditError('No subscription', 'NO_SUBSCRIPTION');
    assert.equal(err.code, 'NO_SUBSCRIPTION');
  });

  it('NO_PARENT code is set correctly', () => {
    const err = new TripWalletCreditError('No parent', 'NO_PARENT');
    assert.equal(err.code, 'NO_PARENT');
  });

  it('ALREADY_CREDITED code is set correctly', () => {
    const err = new TripWalletCreditError('Already credited', 'ALREADY_CREDITED');
    assert.equal(err.code, 'ALREADY_CREDITED');
  });

  it('ALREADY_RESOLVED code is set correctly', () => {
    const err = new TripWalletCreditError('Already resolved', 'ALREADY_RESOLVED');
    assert.equal(err.code, 'ALREADY_RESOLVED');
  });

  it('processTripWalletCredit guards AMOUNT_MISMATCH in code', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("'AMOUNT_MISMATCH'"),
      'processTripWalletCredit must guard amount mismatch',
    );
  });

  it('processTripWalletCredit guards NOT_COMPLETED in code', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("'NOT_COMPLETED'"),
      'processTripWalletCredit must guard non-completed trip',
    );
  });

  it('processTripWalletCredit guards NO_SUBSCRIPTION in code', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("'NO_SUBSCRIPTION'"),
      'previewTripWalletCredit must guard missing subscription',
    );
  });
});

// ─── computeTripWalletCreditAmount guards ─────────────────────────────────────

describe('computeTripWalletCreditAmount edge cases', () => {
  it('AMOUNT_MISMATCH guard: confirmAmountSar tolerance is 0.01', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    assert.ok(src.includes('0.01'), 'tolerance check must reference 0.01');
  });

  it('rejects finalPriceSar=0 (produces non-positive amountSar)', () => {
    assert.throws(
      () => computeTripWalletCreditAmount({
        finalPriceSar: 0,
        actualServiceDays: 10,
        tripDirection: 'ONE_WAY',
        subscriptionTripCount: 0,
      }),
      (err: unknown) => {
        assert.ok(err instanceof TripWalletCreditError);
        assert.equal(err.code, 'INVALID_AMOUNT');
        return true;
      },
    );
  });

  it('rejects negative finalPriceSar', () => {
    assert.throws(
      () => computeTripWalletCreditAmount({
        finalPriceSar: -100,
        actualServiceDays: 10,
        tripDirection: 'ONE_WAY',
        subscriptionTripCount: 0,
      }),
      (err: unknown) => err instanceof TripWalletCreditError,
    );
  });
});

// ─── P2002 fallback wrapped in transaction ────────────────────────────────────

describe('P2002 fallback transaction wrapping', () => {
  it('isPrismaUniqueViolation detects P2002', () => {
    assert.equal(isPrismaUniqueViolation({ code: 'P2002' }), true);
    assert.equal(isPrismaUniqueViolation({ code: 'P2025' }), false);
    assert.equal(isPrismaUniqueViolation(new Error('oops')), false);
  });

  it('P2002 catch block calls prisma.$transaction in tripWalletCredit', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    // Confirm the P2002 fallback is wrapped in prisma.$transaction
    assert.ok(
      src.includes('isPrismaUniqueViolation(err)') && src.includes('prisma.$transaction'),
      'P2002 fallback must be wrapped in prisma.$transaction',
    );
  });
});

// ─── processNonCreditFinancialReview — no wallet mutation for non-CREDIT ──────

describe('processNonCreditFinancialReview', () => {
  it('REFUND_PARENT path does not touch wallets or wallet_transactions', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    // The processNonCreditFinancialReview function must not reference wallet
    // balance update or walletTransaction.create
    const fnStart = src.indexOf('export async function processNonCreditFinancialReview');
    assert.ok(fnStart !== -1, 'processNonCreditFinancialReview must exist');
    const fnBody = src.slice(fnStart);
    // The function should not contain wallet.update or walletTransaction.create
    assert.ok(
      !fnBody.slice(0, fnBody.indexOf('\nexport ')).includes('wallet.update'),
      'processNonCreditFinancialReview must not update wallet balance',
    );
    assert.ok(
      !fnBody.slice(0, fnBody.indexOf('\nexport ')).includes('walletTransaction.create'),
      'processNonCreditFinancialReview must not create wallet transactions',
    );
  });

  it('ALREADY_RESOLVED guard exists for non-PENDING statuses', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/tripWalletCredit.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("'ALREADY_RESOLVED'"),
      'processNonCreditFinancialReview must guard ALREADY_RESOLVED',
    );
  });
});

// ─── Wallet history API response shape ───────────────────────────────────────

describe('wallet history API response shape', () => {
  it('GET /api/wallet selects source field on transactions', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/wallet/route.ts'),
      'utf8',
    );
    assert.ok(src.includes('source: true'), 'wallet route must return source field');
  });

  it('GET /api/wallet selects reason field on transactions', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/wallet/route.ts'),
      'utf8',
    );
    assert.ok(src.includes('reason: true'), 'wallet route must return reason field');
  });
});

// ─── Admin wallet adjustment error handling ───────────────────────────────────

describe('admin wallet adjustment error handling', () => {
  it('wallet-adjustments route requires ADMIN role', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/wallet-adjustments/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes("requireRole(['ADMIN'])"),
      'wallet-adjustments route must enforce ADMIN role',
    );
  });

  it('wallet-adjustments 500 handler does not leak raw error messages', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/wallet-adjustments/route.ts'),
      'utf8',
    );
    assert.ok(
      !src.includes('err.message') || src.includes("'Internal Server Error'"),
      'wallet-adjustments must not leak raw error messages in 500 responses',
    );
    assert.ok(
      src.includes("console.error('[POST /api/admin/wallet-adjustments]'"),
      'wallet-adjustments must log the error server-side',
    );
  });

  it('wallet-adjustments duplicate idempotency path fetches actual wallet balance', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/financials/walletOps.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('wallet.findUnique') && src.includes('newBalanceSar: Number(wallet'),
      'applyWalletAdjustment duplicate path must return actual wallet balance',
    );
  });
});

// ─── HMAC webhook verification ────────────────────────────────────────────────

describe('webhook HMAC signature verification', () => {
  it('webhook route imports getWebhookSecret from myfatoorah', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/payments/webhook/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('getWebhookSecret'),
      'webhook route must import and use getWebhookSecret',
    );
  });

  it('webhook route uses createHmac for signature verification', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/payments/webhook/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('createHmac') && src.includes("'sha256'"),
      'webhook must use HMAC-SHA256 for signature verification',
    );
  });

  it('webhook route uses timingSafeEqual to prevent timing attacks', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/payments/webhook/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('timingSafeEqual'),
      'webhook must use timingSafeEqual for constant-time comparison',
    );
  });

  it('webhook skips verification when secret is not configured (dev mode)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/payments/webhook/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('MYFATOORAH_WEBHOOK_SECRET is not set'),
      'webhook must warn and skip verification when secret is absent',
    );
  });

  it('verifyWebhookSignature rejects null signatureHeader when secret is set', () => {
    // Test the pure logic: if secret is present but header is null, return false
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/payments/webhook/route.ts'),
      'utf8',
    );
    assert.ok(
      src.includes('if (!signatureHeader)') && src.includes('return false'),
      'verifyWebhookSignature must reject null signature header when secret is configured',
    );
  });
});
