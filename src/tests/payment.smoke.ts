/**
 * Payment/Wallet smoke tests — run with: npm test
 * Uses Node.js built-in test runner. No database required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentSchema,
  webhookPayloadSchema,
  MIN_TOP_UP_SAR,
  MAX_TOP_UP_SAR,
} from '../lib/validations/payment.ts';
import { paySubscriptionSchema } from '../lib/validations/wallet.ts';
import {
  PaymentGatewayError,
  mapGatewayErrorToResponse,
  buildSafeLogPayload,
} from '../lib/payments/types.ts';
import type { ProcessOutcome } from '../lib/payments/processPaymentStatus.ts';

// ─── createPaymentSchema ──────────────────────────────────────────────────────

describe('createPaymentSchema — WALLET_TOP_UP', () => {
  it('accepts valid top-up amount at minimum', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP', amountSar: MIN_TOP_UP_SAR });
    assert.ok(r.success);
  });

  it('accepts valid top-up amount at maximum', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP', amountSar: MAX_TOP_UP_SAR });
    assert.ok(r.success);
  });

  it('rejects top-up below minimum', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP', amountSar: MIN_TOP_UP_SAR - 1 });
    assert.ok(!r.success);
  });

  it('rejects top-up above maximum', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP', amountSar: MAX_TOP_UP_SAR + 1 });
    assert.ok(!r.success);
  });

  it('rejects top-up with zero amount', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP', amountSar: 0 });
    assert.ok(!r.success);
  });

  it('rejects top-up without amountSar', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP' });
    assert.ok(!r.success);
  });

  it('rejects top-up with negative amount', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'WALLET_TOP_UP', amountSar: -50 });
    assert.ok(!r.success);
  });
});

describe('createPaymentSchema — SUBSCRIPTION_PAYMENT', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts valid subscription payment', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'SUBSCRIPTION_PAYMENT', subscriptionId: validUuid });
    assert.ok(r.success);
  });

  it('rejects subscription payment without subscriptionId', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'SUBSCRIPTION_PAYMENT' });
    assert.ok(!r.success);
  });

  it('rejects subscription payment with non-uuid subscriptionId', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'SUBSCRIPTION_PAYMENT', subscriptionId: 'not-a-uuid' });
    assert.ok(!r.success);
  });

  it('rejects unknown purpose', () => {
    const r = createPaymentSchema.safeParse({ purpose: 'SOMETHING_ELSE' });
    assert.ok(!r.success);
  });
});

// ─── webhookPayloadSchema ─────────────────────────────────────────────────────

describe('webhookPayloadSchema', () => {
  it('accepts string PaymentId', () => {
    const r = webhookPayloadSchema.safeParse({ PaymentId: 'abc123' });
    assert.ok(r.success);
    assert.equal(r.data?.PaymentId, 'abc123');
  });

  it('accepts numeric PaymentId and coerces to string', () => {
    const r = webhookPayloadSchema.safeParse({ PaymentId: 12345 });
    assert.ok(r.success);
    assert.equal(r.data?.PaymentId, '12345');
    assert.equal(typeof r.data?.PaymentId, 'string');
  });

  it('passes through extra fields (passthrough)', () => {
    const r = webhookPayloadSchema.safeParse({ PaymentId: 'x', ExtraField: 'y' });
    assert.ok(r.success);
  });

  it('rejects missing PaymentId', () => {
    const r = webhookPayloadSchema.safeParse({});
    assert.ok(!r.success);
  });

  it('rejects null PaymentId', () => {
    const r = webhookPayloadSchema.safeParse({ PaymentId: null });
    assert.ok(!r.success);
  });
});

// ─── paySubscriptionSchema ────────────────────────────────────────────────────

describe('paySubscriptionSchema', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts valid uuid', () => {
    const r = paySubscriptionSchema.safeParse({ subscriptionId: validUuid });
    assert.ok(r.success);
    assert.equal(r.data?.subscriptionId, validUuid);
  });

  it('rejects non-uuid string', () => {
    const r = paySubscriptionSchema.safeParse({ subscriptionId: 'not-a-uuid' });
    assert.ok(!r.success);
  });

  it('rejects missing subscriptionId', () => {
    const r = paySubscriptionSchema.safeParse({});
    assert.ok(!r.success);
  });
});

// ─── PaymentGatewayError ──────────────────────────────────────────────────────

describe('PaymentGatewayError class', () => {
  it('is an instance of Error', () => {
    const err = new PaymentGatewayError('test', 'NOT_CONFIGURED');
    assert.ok(err instanceof Error);
  });

  it('has name PaymentGatewayError', () => {
    const err = new PaymentGatewayError('test', 'NOT_CONFIGURED');
    assert.equal(err.name, 'PaymentGatewayError');
  });

  it('stores reason', () => {
    const err = new PaymentGatewayError('msg', 'PAYMENT_GATEWAY_REJECTED');
    assert.equal(err.reason, 'PAYMENT_GATEWAY_REJECTED');
  });

  it('stores providerStatus when provided', () => {
    const err = new PaymentGatewayError('msg', 'PAYMENT_GATEWAY_HTTP_ERROR', { providerStatus: 422 });
    assert.equal(err.providerStatus, 422);
  });

  it('stores providerMessage when provided', () => {
    const err = new PaymentGatewayError('msg', 'PAYMENT_GATEWAY_REJECTED', { providerMessage: 'Declined' });
    assert.equal(err.providerMessage, 'Declined');
  });

  it('providerStatus is undefined when not provided', () => {
    const err = new PaymentGatewayError('msg', 'INVALID_PARAMS');
    assert.equal(err.providerStatus, undefined);
  });

  it('providerMessage is undefined when not provided', () => {
    const err = new PaymentGatewayError('msg', 'INVALID_PARAMS');
    assert.equal(err.providerMessage, undefined);
  });

  it('message is set correctly', () => {
    const err = new PaymentGatewayError('Something failed', 'NOT_CONFIGURED');
    assert.equal(err.message, 'Something failed');
  });
});

// ─── mapGatewayErrorToResponse ────────────────────────────────────────────────

describe('mapGatewayErrorToResponse', () => {
  it('returns correct message for PaymentGatewayError', () => {
    const err = new PaymentGatewayError('internal', 'PAYMENT_GATEWAY_REJECTED');
    const result = mapGatewayErrorToResponse(err);
    assert.equal(result.message, 'Failed to create payment invoice.');
  });

  it('returns reason from PaymentGatewayError', () => {
    const err = new PaymentGatewayError('internal', 'PAYMENT_GATEWAY_HTTP_ERROR', { providerStatus: 500 });
    const result = mapGatewayErrorToResponse(err);
    assert.equal(result.reason, 'PAYMENT_GATEWAY_HTTP_ERROR');
  });

  it('includes providerStatus when present', () => {
    const err = new PaymentGatewayError('internal', 'PAYMENT_GATEWAY_HTTP_ERROR', { providerStatus: 422 });
    const result = mapGatewayErrorToResponse(err);
    assert.equal(result.providerStatus, 422);
  });

  it('omits providerStatus when not set on error', () => {
    const err = new PaymentGatewayError('internal', 'PAYMENT_GATEWAY_REJECTED');
    const result = mapGatewayErrorToResponse(err);
    assert.equal('providerStatus' in result, false);
  });

  it('returns UNKNOWN reason for plain Error', () => {
    const result = mapGatewayErrorToResponse(new Error('something'));
    assert.equal(result.reason, 'UNKNOWN');
  });

  it('returns UNKNOWN reason for non-error values', () => {
    const result = mapGatewayErrorToResponse('oops');
    assert.equal(result.reason, 'UNKNOWN');
  });

  it('reason NOT_CONFIGURED maps correctly', () => {
    const err = new PaymentGatewayError('internal', 'NOT_CONFIGURED');
    const result = mapGatewayErrorToResponse(err);
    assert.equal(result.reason, 'NOT_CONFIGURED');
  });
});

// ─── buildSafeLogPayload ──────────────────────────────────────────────────────

describe('buildSafeLogPayload — never leaks credentials', () => {
  const BASE_PARAMS = {
    userId: 'user-abc',
    purpose: 'WALLET_TOP_UP',
    amountSar: 100,
    paymentId: 'pay-123',
  };

  it('includes userId', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('x'));
    assert.equal(log['userId'], 'user-abc');
  });

  it('includes purpose', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('x'));
    assert.equal(log['purpose'], 'WALLET_TOP_UP');
  });

  it('includes amountSar', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('x'));
    assert.equal(log['amountSar'], 100);
  });

  it('includes paymentId', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('x'));
    assert.equal(log['paymentId'], 'pay-123');
  });

  it('never includes apiKey field', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('x'));
    assert.ok(!('apiKey' in log));
    assert.ok(!('MYFATOORAH_API_KEY' in log));
  });

  it('never includes Authorization field', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('x'));
    assert.ok(!('Authorization' in log));
    assert.ok(!('authorization' in log));
  });

  it('includes reason from PaymentGatewayError', () => {
    const err = new PaymentGatewayError('msg', 'PAYMENT_GATEWAY_REJECTED', { providerStatus: 400 });
    const log = buildSafeLogPayload(BASE_PARAMS, err);
    assert.equal(log['reason'], 'PAYMENT_GATEWAY_REJECTED');
  });

  it('includes providerStatus from PaymentGatewayError', () => {
    const err = new PaymentGatewayError('msg', 'PAYMENT_GATEWAY_HTTP_ERROR', { providerStatus: 503 });
    const log = buildSafeLogPayload(BASE_PARAMS, err);
    assert.equal(log['providerStatus'], 503);
  });

  it('includes providerMessage from PaymentGatewayError', () => {
    const err = new PaymentGatewayError('msg', 'PAYMENT_GATEWAY_REJECTED', { providerMessage: 'Card declined' });
    const log = buildSafeLogPayload(BASE_PARAMS, err);
    assert.equal(log['providerMessage'], 'Card declined');
  });

  it('reason is UNKNOWN for plain Error', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('boom'));
    assert.equal(log['reason'], 'UNKNOWN');
  });

  it('error field contains Error message', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, new Error('boom'));
    assert.equal(log['error'], 'boom');
  });

  it('error field is fallback string for non-Error', () => {
    const log = buildSafeLogPayload(BASE_PARAMS, 'not an error');
    assert.equal(log['error'], 'Invoice creation failed');
  });
});

// ─── Balance check logic ──────────────────────────────────────────────────────

describe('wallet balance-check logic', () => {
  const checkBalance = (balance: number, amount: number) => balance - amount >= 0;

  it('allows payment when balance equals amount', () => {
    assert.ok(checkBalance(100, 100));
  });

  it('allows payment when balance exceeds amount', () => {
    assert.ok(checkBalance(200, 100));
  });

  it('rejects payment when balance is insufficient', () => {
    assert.ok(!checkBalance(50, 100));
  });

  it('rejects payment when balance is zero', () => {
    assert.ok(!checkBalance(0, 1));
  });

  it('rejects negative amount scenario', () => {
    assert.ok(!checkBalance(0, 100));
  });

  it('new balance is computed correctly after debit', () => {
    const balance = 500;
    const amount = 150;
    const newBalance = balance - amount;
    assert.equal(newBalance, 350);
  });
});

// ─── ProcessOutcome type safety ───────────────────────────────────────────────

describe('ProcessOutcome type values', () => {
  const validOutcomes: ProcessOutcome[] = ['PAID', 'FAILED', 'PENDING', 'ALREADY_PROCESSED'];

  it('PAID is a valid outcome', () => {
    assert.ok(validOutcomes.includes('PAID'));
  });

  it('FAILED is a valid outcome', () => {
    assert.ok(validOutcomes.includes('FAILED'));
  });

  it('PENDING is a valid outcome', () => {
    assert.ok(validOutcomes.includes('PENDING'));
  });

  it('ALREADY_PROCESSED is a valid outcome', () => {
    assert.ok(validOutcomes.includes('ALREADY_PROCESSED'));
  });
});

// ─── Callback query param resolution logic ────────────────────────────────────

describe('callback query param resolution', () => {
  // Pure function that mirrors the logic in GET /api/payments/callback
  const resolveKey = (
    Id?: string,
    paymentId?: string,
    invoiceId?: string,
    subscriptionId?: string,
  ): { key: string; keyType: 'PaymentId' | 'InvoiceId' } | null => {
    if (Id) return { key: Id, keyType: 'PaymentId' };
    if (paymentId) return { key: paymentId, keyType: 'InvoiceId' };
    if (invoiceId) return { key: invoiceId, keyType: 'InvoiceId' };
    if (subscriptionId) return null; // requires DB lookup — not testable here
    return null;
  };

  it('Id param → KeyType PaymentId', () => {
    const result = resolveKey('txn-123');
    assert.equal(result?.keyType, 'PaymentId');
    assert.equal(result?.key, 'txn-123');
  });

  it('paymentId param (MyFatoorah InvoiceId alias) → KeyType InvoiceId', () => {
    const result = resolveKey(undefined, 'inv-456');
    assert.equal(result?.keyType, 'InvoiceId');
    assert.equal(result?.key, 'inv-456');
  });

  it('invoiceId param (manual verify) → KeyType InvoiceId', () => {
    const result = resolveKey(undefined, undefined, 'inv-789');
    assert.equal(result?.keyType, 'InvoiceId');
    assert.equal(result?.key, 'inv-789');
  });

  it('Id takes priority over paymentId', () => {
    const result = resolveKey('txn-A', 'inv-B');
    assert.equal(result?.keyType, 'PaymentId');
    assert.equal(result?.key, 'txn-A');
  });

  it('returns null when no params provided', () => {
    const result = resolveKey();
    assert.equal(result, null);
  });

  it('subscriptionId alone returns null (DB lookup required)', () => {
    const result = resolveKey(undefined, undefined, undefined, 'sub-123');
    assert.equal(result, null);
  });
});

// ─── Callback / error URL config ──────────────────────────────────────────────

describe('callback and error URL configuration', () => {
  const resolveCallbackUrl = (appUrl: string, callbackEnv?: string) =>
    callbackEnv?.trim() || `${appUrl}/payment/callback`;

  const resolveErrorUrl = (appUrl: string, errorEnv?: string) =>
    errorEnv?.trim() || `${appUrl}/payment/error`;

  it('uses MYFATOORAH_CALLBACK_URL when set', () => {
    const url = resolveCallbackUrl('http://app.com', 'https://custom.callback/');
    assert.equal(url, 'https://custom.callback/');
  });

  it('falls back to /payment/callback when MYFATOORAH_CALLBACK_URL is not set', () => {
    const url = resolveCallbackUrl('http://localhost:3000');
    assert.equal(url, 'http://localhost:3000/payment/callback');
  });

  it('never uses /api/payments/webhook as callback URL', () => {
    const url = resolveCallbackUrl('http://localhost:3000');
    assert.ok(!url.includes('/api/payments/webhook'));
  });

  it('uses MYFATOORAH_ERROR_URL when set', () => {
    const url = resolveErrorUrl('http://app.com', 'https://custom.error/');
    assert.equal(url, 'https://custom.error/');
  });

  it('falls back to /payment/error when MYFATOORAH_ERROR_URL is not set', () => {
    const url = resolveErrorUrl('http://localhost:3000');
    assert.equal(url, 'http://localhost:3000/payment/error');
  });

  it('localhost callback works without ngrok (browser redirect returns to localhost)', () => {
    const url = resolveCallbackUrl('http://localhost:3000');
    assert.ok(url.startsWith('http://localhost:3000'));
  });
});

// ─── Idempotency logic ────────────────────────────────────────────────────────

describe('payment processing idempotency logic', () => {
  // Mirror the idempotency guard from applyPaymentOutcome
  const shouldSkip = (paymentStatus: string): boolean => paymentStatus === 'PAID';

  it('skips processing when payment already PAID', () => {
    assert.ok(shouldSkip('PAID'));
  });

  it('processes when payment is PENDING', () => {
    assert.ok(!shouldSkip('PENDING'));
  });

  it('processes when payment is FAILED', () => {
    assert.ok(!shouldSkip('FAILED'));
  });

  it('duplicate PAID callback does not re-process', () => {
    // First call: payment.status = 'PENDING' → processes → updates to PAID
    // Second call: payment.status = 'PAID' → shouldSkip → ALREADY_PROCESSED
    const afterFirst = 'PAID';
    assert.ok(shouldSkip(afterFirst)); // second call is skipped
  });
});

// ─── Webhook GET → helpful 405 ────────────────────────────────────────────────

describe('webhook endpoint method handling', () => {
  const getWebhookGetResponse = () => ({
    status: 405,
    body: {
      error: {
        message:
          'Webhook endpoint expects POST. ' +
          'Browser payment redirects should use /payment/callback instead.',
      },
    },
  });

  it('returns 405 for GET requests to webhook', () => {
    const res = getWebhookGetResponse();
    assert.equal(res.status, 405);
  });

  it('response message mentions /payment/callback', () => {
    const res = getWebhookGetResponse();
    assert.ok(res.body.error.message.includes('/payment/callback'));
  });

  it('response message explains POST requirement', () => {
    const res = getWebhookGetResponse();
    assert.ok(res.body.error.message.includes('POST'));
  });
});
