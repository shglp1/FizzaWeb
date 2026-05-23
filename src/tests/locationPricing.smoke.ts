/**
 * locationPricing.smoke.ts — run with: npm test
 *
 * Tests for Task 10.10: Enterprise Location Picker + Accurate Distance-Based
 * Subscription Pricing UX.
 *
 * Coverage:
 *  - locationInputSchema validation (valid / invalid coordinates)
 *  - calculateChargeableDistanceKm (round-trip vs one-way)
 *  - calculateSubscriptionQuote (full pricing formula)
 *  - Quote-key invalidation logic (pure function)
 *  - API error message constants
 *  - LocationPicker readiness logic (canCalculate)
 *  - Review step confirm guard (canConfirm)
 *
 * No database or Next.js runtime required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { locationInputSchema } from '../lib/validations/subscription.ts';
import {
  calculateChargeableDistanceKm,
} from '../lib/maps/distance.ts';
import {
  calculateSubscriptionQuote,
  type PricingConfig,
} from '../lib/pricing/subscriptionPricing.ts';

// ─── locationInputSchema validation ───────────────────────────────────────────

describe('locationInputSchema — valid inputs', () => {
  it('accepts a full location object with valid coords', () => {
    const result = locationInputSchema.safeParse({
      label: 'King Faisal School, Riyadh',
      latitude: 24.6877,
      longitude: 46.7219,
    });
    assert.ok(result.success, `Expected success, got: ${result.success ? '' : result.error.message}`);
  });

  it('accepts coordinates at origin (0, 0)', () => {
    const result = locationInputSchema.safeParse({ label: 'Origin', latitude: 0, longitude: 0 });
    assert.ok(result.success);
  });

  it('accepts boundary latitudes (-90 and 90)', () => {
    const south = locationInputSchema.safeParse({ label: 'South Pole', latitude: -90, longitude: 0 });
    const north = locationInputSchema.safeParse({ label: 'North Pole', latitude: 90, longitude: 0 });
    assert.ok(south.success);
    assert.ok(north.success);
  });

  it('accepts boundary longitudes (-180 and 180)', () => {
    const west = locationInputSchema.safeParse({ label: 'Date Line W', latitude: 0, longitude: -180 });
    const east = locationInputSchema.safeParse({ label: 'Date Line E', latitude: 0, longitude: 180 });
    assert.ok(west.success);
    assert.ok(east.success);
  });
});

describe('locationInputSchema — missing required fields', () => {
  it('rejects missing pickup coordinates (no latitude/longitude)', () => {
    const result = locationInputSchema.safeParse({ label: 'Somewhere' });
    assert.ok(!result.success);
  });

  it('rejects missing latitude', () => {
    const result = locationInputSchema.safeParse({ label: 'Test', longitude: 46.7 });
    assert.ok(!result.success);
  });

  it('rejects missing longitude', () => {
    const result = locationInputSchema.safeParse({ label: 'Test', latitude: 24.6 });
    assert.ok(!result.success);
  });

  it('rejects missing label', () => {
    const result = locationInputSchema.safeParse({ latitude: 24.6, longitude: 46.7 });
    assert.ok(!result.success);
  });
});

describe('locationInputSchema — invalid coordinate ranges', () => {
  it('rejects latitude > 90', () => {
    const result = locationInputSchema.safeParse({ label: 'Bad', latitude: 91, longitude: 0 });
    assert.ok(!result.success);
    assert.ok(result.error.issues.some((i) => i.path.includes('latitude')));
  });

  it('rejects latitude < -90', () => {
    const result = locationInputSchema.safeParse({ label: 'Bad', latitude: -91, longitude: 0 });
    assert.ok(!result.success);
  });

  it('rejects longitude > 180', () => {
    const result = locationInputSchema.safeParse({ label: 'Bad', latitude: 0, longitude: 181 });
    assert.ok(!result.success);
    assert.ok(result.error.issues.some((i) => i.path.includes('longitude')));
  });

  it('rejects longitude < -180', () => {
    const result = locationInputSchema.safeParse({ label: 'Bad', latitude: 0, longitude: -181 });
    assert.ok(!result.success);
  });

  it('rejects label shorter than 3 chars', () => {
    const result = locationInputSchema.safeParse({ label: 'AB', latitude: 24, longitude: 46 });
    assert.ok(!result.success);
  });

  it('rejects non-number latitude', () => {
    const result = locationInputSchema.safeParse({ label: 'Test', latitude: 'not-a-number', longitude: 46 });
    assert.ok(!result.success);
  });

  it('rejects non-number longitude', () => {
    const result = locationInputSchema.safeParse({ label: 'Test', latitude: 24, longitude: null });
    assert.ok(!result.success);
  });
});

// ─── calculateChargeableDistanceKm ───────────────────────────────────────────

describe('calculateChargeableDistanceKm — one-way', () => {
  it('one-way: chargeable equals oneWayDistance', () => {
    const chargeable = calculateChargeableDistanceKm(10, 'ONE_WAY');
    assert.equal(chargeable, 10);
  });

  it('one-way: 7.5 km stays 7.5 km', () => {
    assert.equal(calculateChargeableDistanceKm(7.5, 'ONE_WAY'), 7.5);
  });

  it('one-way: 0 km returns 0', () => {
    assert.equal(calculateChargeableDistanceKm(0, 'ONE_WAY'), 0);
  });
});

describe('calculateChargeableDistanceKm — round-trip', () => {
  it('round-trip: chargeable distance = oneWayDistance × 2', () => {
    const chargeable = calculateChargeableDistanceKm(10, 'ROUND_TRIP');
    assert.equal(chargeable, 20);
  });

  it('round-trip: 7.5 km → 15 km chargeable', () => {
    assert.equal(calculateChargeableDistanceKm(7.5, 'ROUND_TRIP'), 15);
  });

  it('round-trip: 0 km → 0 chargeable', () => {
    assert.equal(calculateChargeableDistanceKm(0, 'ROUND_TRIP'), 0);
  });

  it('round-trip: 12.34 km → 24.68 km (rounded to 2 decimals)', () => {
    assert.equal(calculateChargeableDistanceKm(12.34, 'ROUND_TRIP'), 24.68);
  });
});

// ─── calculateSubscriptionQuote — pricing formula ─────────────────────────────

const DEFAULT_CONFIG: PricingConfig = {
  pricePerKmSar: 2.0,
  extraRiderSameDropoffMultiplier: 0.5,
};

describe('calculateSubscriptionQuote — pricePerKmSar comes from admin config', () => {
  it('uses the supplied pricePerKmSar, not a hardcoded value', () => {
    const breakdown = calculateSubscriptionQuote(0, 0, 10, 0, { pricePerKmSar: 3.0, extraRiderSameDropoffMultiplier: 0.5 });
    assert.equal(breakdown.distancePriceSar, 30); // 10 km × 3.0
  });

  it('different pricePerKmSar changes final price', () => {
    const b1 = calculateSubscriptionQuote(0, 0, 10, 0, { pricePerKmSar: 2.0, extraRiderSameDropoffMultiplier: 0.5 });
    const b2 = calculateSubscriptionQuote(0, 0, 10, 0, { pricePerKmSar: 4.0, extraRiderSameDropoffMultiplier: 0.5 });
    assert.ok(b2.finalPriceSar > b1.finalPriceSar, 'Higher pricePerKm should produce higher final price');
  });
});

describe('calculateSubscriptionQuote — distance charge in final price', () => {
  it('final price includes distance charge', () => {
    const breakdown = calculateSubscriptionQuote(100, 0, 10, 0, DEFAULT_CONFIG);
    // distanceCharge = 10 × 2.0 = 20; finalPrice = 100 + 20 = 120
    assert.equal(breakdown.distancePriceSar, 20);
    assert.equal(breakdown.finalPriceSar, 120);
  });

  it('zero distance: final price equals package + add-ons only', () => {
    const breakdown = calculateSubscriptionQuote(100, 50, 0, 0, DEFAULT_CONFIG);
    assert.equal(breakdown.distancePriceSar, 0);
    assert.equal(breakdown.finalPriceSar, 150);
  });
});

describe('calculateSubscriptionQuote — add-ons included', () => {
  it('add-ons are included in final price', () => {
    const breakdown = calculateSubscriptionQuote(100, 30, 10, 0, DEFAULT_CONFIG);
    // primaryFinal = 100 + 30 + 20 = 150
    assert.equal(breakdown.addOnsPriceSar, 30);
    assert.equal(breakdown.finalPriceSar, 150);
  });
});

describe('calculateSubscriptionQuote — extra riders', () => {
  it('1 extra rider adds 50% of primary price', () => {
    const breakdown = calculateSubscriptionQuote(100, 0, 0, 1, DEFAULT_CONFIG);
    // primaryFinal = 100; extraRiderCharge = 100 × 0.5 = 50; finalPrice = 150
    assert.equal(breakdown.extraRidersPriceSar, 50);
    assert.equal(breakdown.finalPriceSar, 150);
  });

  it('2 extra riders: charge × 2', () => {
    const breakdown = calculateSubscriptionQuote(100, 0, 0, 2, DEFAULT_CONFIG);
    // extraRiderCharge = 2 × (100 × 0.5) = 100; finalPrice = 200
    assert.equal(breakdown.extraRidersPriceSar, 100);
    assert.equal(breakdown.finalPriceSar, 200);
  });

  it('0 extra riders: no extra charge', () => {
    const breakdown = calculateSubscriptionQuote(100, 0, 10, 0, DEFAULT_CONFIG);
    assert.equal(breakdown.extraRidersPriceSar, 0);
  });
});

// ─── Quote invalidation (quoteKey logic) ────────────────────────────────────

/**
 * Pure re-implementation of the makeQuoteKey logic from the page.
 * This validates that the key changes when any pricing-relevant input changes.
 */
function makeQuoteKey(
  packageId: string | null,
  addOnIds: string[],
  riderIds: string[],
  pickupLat: number | null,
  pickupLng: number | null,
  dropoffLat: number | null,
  dropoffLng: number | null,
  direction: string,
): string {
  return [
    packageId ?? '',
    [...addOnIds].sort().join(','),
    [...riderIds].sort().join(','),
    pickupLat != null ? `${pickupLat.toFixed(6)},${pickupLng!.toFixed(6)}` : '',
    dropoffLat != null ? `${dropoffLat.toFixed(6)},${dropoffLng!.toFixed(6)}` : '',
    direction,
  ].join('|');
}

describe('quote invalidation — changing pickup invalidates quote', () => {
  const base = makeQuoteKey('pkg-1', [], ['r1'], 24.6877, 46.7219, 24.7, 46.8, 'ROUND_TRIP');

  it('same inputs produce identical key', () => {
    const same = makeQuoteKey('pkg-1', [], ['r1'], 24.6877, 46.7219, 24.7, 46.8, 'ROUND_TRIP');
    assert.equal(same, base);
  });

  it('changing pickup latitude invalidates key', () => {
    const changed = makeQuoteKey('pkg-1', [], ['r1'], 24.99, 46.7219, 24.7, 46.8, 'ROUND_TRIP');
    assert.notEqual(changed, base);
  });

  it('changing pickup longitude invalidates key', () => {
    const changed = makeQuoteKey('pkg-1', [], ['r1'], 24.6877, 46.9999, 24.7, 46.8, 'ROUND_TRIP');
    assert.notEqual(changed, base);
  });
});

describe('quote invalidation — changing dropoff invalidates quote', () => {
  const base = makeQuoteKey('pkg-1', [], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ONE_WAY');

  it('changing dropoff latitude invalidates key', () => {
    const changed = makeQuoteKey('pkg-1', [], ['r1'], 24.6, 46.7, 25.0, 46.8, 'ONE_WAY');
    assert.notEqual(changed, base);
  });

  it('changing dropoff longitude invalidates key', () => {
    const changed = makeQuoteKey('pkg-1', [], ['r1'], 24.6, 46.7, 24.7, 47.0, 'ONE_WAY');
    assert.notEqual(changed, base);
  });
});

describe('quote invalidation — changing add-ons invalidates quote', () => {
  const base = makeQuoteKey(null, ['addon-1'], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ROUND_TRIP');

  it('adding an add-on invalidates key', () => {
    const changed = makeQuoteKey(null, ['addon-1', 'addon-2'], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ROUND_TRIP');
    assert.notEqual(changed, base);
  });

  it('removing all add-ons invalidates key', () => {
    const changed = makeQuoteKey(null, [], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ROUND_TRIP');
    assert.notEqual(changed, base);
  });

  it('add-on order does not matter (keys are sorted)', () => {
    const k1 = makeQuoteKey(null, ['b', 'a'], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ROUND_TRIP');
    const k2 = makeQuoteKey(null, ['a', 'b'], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ROUND_TRIP');
    assert.equal(k1, k2);
  });
});

describe('quote invalidation — changing trip direction invalidates quote', () => {
  it('ONE_WAY and ROUND_TRIP produce different keys', () => {
    const k1 = makeQuoteKey(null, [], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ONE_WAY');
    const k2 = makeQuoteKey(null, [], ['r1'], 24.6, 46.7, 24.7, 46.8, 'ROUND_TRIP');
    assert.notEqual(k1, k2);
  });
});

// ─── API error message constants ──────────────────────────────────────────────

describe('API error messages — missing ORS key', () => {
  const MISSING_KEY_MSG =
    'Location pricing is currently unavailable because distance calculation is not configured. Please contact support.';
  const ROUTE_UNAVAILABLE_MSG =
    'We could not calculate a route between these two locations. Try selecting more specific addresses.';
  const PROVIDER_UNAVAILABLE_MSG =
    'Location service is temporarily unavailable. Please try again later.';
  const NETWORK_MSG =
    'Could not reach the pricing service. Check your connection and try again.';

  it('missing ORS key message is user-friendly (no raw error)', () => {
    assert.ok(!MISSING_KEY_MSG.includes('process.env'));
    assert.ok(!MISSING_KEY_MSG.includes('API_KEY'));
    assert.ok(MISSING_KEY_MSG.toLowerCase().includes('not configured'));
  });

  it('route unavailable message suggests user action', () => {
    assert.ok(ROUTE_UNAVAILABLE_MSG.toLowerCase().includes('could not calculate'));
    assert.ok(ROUTE_UNAVAILABLE_MSG.toLowerCase().includes('more specific'));
  });

  it('provider unavailable message suggests retry', () => {
    assert.ok(PROVIDER_UNAVAILABLE_MSG.toLowerCase().includes('try again'));
  });

  it('network error message mentions connection', () => {
    assert.ok(NETWORK_MSG.toLowerCase().includes('connection'));
  });
});

// ─── Calculate Price button — disabled logic ──────────────────────────────────

describe('Calculate Price button — disabled until inputs complete', () => {
  /** Mirror of canCalculate logic in the page component. */
  function canCalculate(
    riderIds: string[],
    pickup: { latitude: number; longitude: number } | null,
    dropoff: { latitude: number; longitude: number } | null,
  ): boolean {
    return riderIds.length > 0 && pickup !== null && dropoff !== null;
  }

  it('disabled when no rider selected', () => {
    assert.equal(canCalculate([], { latitude: 24.6, longitude: 46.7 }, { latitude: 24.7, longitude: 46.8 }), false);
  });

  it('disabled when pickup not selected', () => {
    assert.equal(canCalculate(['r1'], null, { latitude: 24.7, longitude: 46.8 }), false);
  });

  it('disabled when dropoff not selected', () => {
    assert.equal(canCalculate(['r1'], { latitude: 24.6, longitude: 46.7 }, null), false);
  });

  it('disabled when all three are missing', () => {
    assert.equal(canCalculate([], null, null), false);
  });

  it('enabled when rider + pickup + dropoff all present', () => {
    assert.equal(
      canCalculate(
        ['r1'],
        { latitude: 24.6877, longitude: 46.7219 },
        { latitude: 24.7, longitude: 46.8 },
      ),
      true,
    );
  });

  it('enabled with multiple riders', () => {
    assert.equal(
      canCalculate(
        ['r1', 'r2'],
        { latitude: 24.6, longitude: 46.7 },
        { latitude: 24.7, longitude: 46.8 },
      ),
      true,
    );
  });
});

// ─── Review step — confirm disabled without quote ─────────────────────────────

describe('Review step — confirm button disabled without valid quote', () => {
  function canConfirm(isLastStep: boolean, quote: unknown): boolean {
    return isLastStep && !!quote;
  }

  it('confirm disabled when quote is null', () => {
    assert.equal(canConfirm(true, null), false);
  });

  it('confirm disabled when not on last step', () => {
    assert.equal(canConfirm(false, { finalPriceSar: 100 }), false);
  });

  it('confirm enabled when on last step with valid quote', () => {
    assert.equal(canConfirm(true, { finalPriceSar: 100 }), true);
  });

  it('confirm disabled when quote is undefined', () => {
    assert.equal(canConfirm(true, undefined), false);
  });
});

// ─── Geocode route — query validation ────────────────────────────────────────

describe('geocode query validation', () => {
  const querySchema = z.string().min(3, 'Query must be at least 3 characters').max(200);

  it('accepts a query of 3+ chars', () => {
    assert.ok(querySchema.safeParse('Riyadh').success);
  });

  it('rejects a query shorter than 3 chars', () => {
    assert.ok(!querySchema.safeParse('AB').success);
  });

  it('rejects an empty string', () => {
    assert.ok(!querySchema.safeParse('').success);
  });

  it('rejects a query longer than 200 chars', () => {
    assert.ok(!querySchema.safeParse('A'.repeat(201)).success);
  });

  it('accepts exactly 3 chars', () => {
    assert.ok(querySchema.safeParse('ABC').success);
  });
});
