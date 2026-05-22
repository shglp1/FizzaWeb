/**
 * Pricing smoke tests — run with: npm test
 * No database required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceCharge,
  calculateExtraRiderCharge,
  calculateSubscriptionQuote,
} from '../lib/pricing/subscriptionPricing.ts';

const DEFAULT_CONFIG = { pricePerKmSar: 2.0, extraRiderSameDropoffMultiplier: 0.5 };

// ─── calculateDistanceCharge ──────────────────────────────────────────────────

describe('calculateDistanceCharge', () => {
  it('returns 0 for zero distance', () => {
    assert.equal(calculateDistanceCharge(0, 2.0), 0);
  });

  it('returns 0 for zero price per km', () => {
    assert.equal(calculateDistanceCharge(10, 0), 0);
  });

  it('calculates correctly: 10km * 2 SAR = 20 SAR', () => {
    assert.equal(calculateDistanceCharge(10, 2.0), 20.0);
  });

  it('rounds to 2 decimal places', () => {
    assert.equal(calculateDistanceCharge(3, 1.333), 4.0);
  });

  it('handles non-integer km', () => {
    assert.equal(calculateDistanceCharge(5.5, 2.0), 11.0);
  });

  it('returns 0 for negative distance', () => {
    assert.equal(calculateDistanceCharge(-5, 2.0), 0);
  });
});

// ─── calculateExtraRiderCharge ────────────────────────────────────────────────

describe('calculateExtraRiderCharge', () => {
  it('returns 50% of primary price with default multiplier', () => {
    assert.equal(calculateExtraRiderCharge(400, 0.5), 200.0);
  });

  it('returns 0 for zero primary price', () => {
    assert.equal(calculateExtraRiderCharge(0, 0.5), 0);
  });

  it('respects custom multiplier', () => {
    assert.equal(calculateExtraRiderCharge(400, 0.3), 120.0);
  });
});

// ─── calculateSubscriptionQuote ───────────────────────────────────────────────

describe('calculateSubscriptionQuote — single rider', () => {
  it('returns correct breakdown for single rider', () => {
    const result = calculateSubscriptionQuote(200, 50, 10, 0, DEFAULT_CONFIG);
    // packagePrice=200, addOns=50, distance=10*2=20 → primary=270, noExtra → final=270
    assert.equal(result.packagePriceSar, 200);
    assert.equal(result.addOnsPriceSar, 50);
    assert.equal(result.distancePriceSar, 20);
    assert.equal(result.primaryFinalSar, 270);
    assert.equal(result.extraRidersPriceSar, 0);
    assert.equal(result.finalPriceSar, 270);
  });

  it('returns zero distance charge when distance is 0', () => {
    const result = calculateSubscriptionQuote(300, 0, 0, 0, DEFAULT_CONFIG);
    assert.equal(result.distancePriceSar, 0);
    assert.equal(result.finalPriceSar, 300);
  });
});

describe('calculateSubscriptionQuote — multiple riders', () => {
  it('adds 50% for one extra rider', () => {
    const result = calculateSubscriptionQuote(200, 0, 0, 1, DEFAULT_CONFIG);
    // primary=200, extra=200*0.5=100, final=300
    assert.equal(result.primaryFinalSar, 200);
    assert.equal(result.extraRidersPriceSar, 100);
    assert.equal(result.finalPriceSar, 300);
  });

  it('adds 50% twice for two extra riders', () => {
    const result = calculateSubscriptionQuote(200, 0, 0, 2, DEFAULT_CONFIG);
    // primary=200, extra=2*100=200, final=400
    assert.equal(result.extraRidersPriceSar, 200);
    assert.equal(result.finalPriceSar, 400);
  });

  it('uses distance in primary price before extra rider calculation', () => {
    // package=200, distance=10km*2=20 → primary=220, extra=220*0.5=110, final=330
    const result = calculateSubscriptionQuote(200, 0, 10, 1, DEFAULT_CONFIG);
    assert.equal(result.primaryFinalSar, 220);
    assert.equal(result.extraRidersPriceSar, 110);
    assert.equal(result.finalPriceSar, 330);
  });

  it('ignores negative extra rider count', () => {
    const result = calculateSubscriptionQuote(200, 0, 0, -1, DEFAULT_CONFIG);
    assert.equal(result.extraRidersPriceSar, 0);
    assert.equal(result.finalPriceSar, 200);
  });

  it('exposes pricing config in result', () => {
    const result = calculateSubscriptionQuote(100, 0, 0, 0, { pricePerKmSar: 3.5, extraRiderSameDropoffMultiplier: 0.4 });
    assert.equal(result.pricePerKmSar, 3.5);
    assert.equal(result.extraRiderMultiplier, 0.4);
  });
});

describe('calculateSubscriptionQuote — validation schema', () => {
  it('full breakdown: package + addons + distance + extra rider', () => {
    // packagePrice=300, addOns=50, distance=20km*2=40 → primary=390, extra=390*0.5=195, final=585
    const result = calculateSubscriptionQuote(300, 50, 20, 1, DEFAULT_CONFIG);
    assert.equal(result.packagePriceSar, 300);
    assert.equal(result.addOnsPriceSar, 50);
    assert.equal(result.distancePriceSar, 40);
    assert.equal(result.primaryFinalSar, 390);
    assert.equal(result.extraRidersPriceSar, 195);
    assert.equal(result.finalPriceSar, 585);
  });
});
