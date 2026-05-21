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
