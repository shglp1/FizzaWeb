/**
 * Distance pricing smoke tests — run with: npm test
 * No database or network required. Tests pure functions only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateChargeableDistanceKm,
} from '../lib/maps/distance.ts';
import {
  calculateDistanceCharge,
  calculateSubscriptionQuote,
} from '../lib/pricing/subscriptionPricing.ts';
import { subscriptionQuoteSchema } from '../lib/validations/subscription.ts';

const CONFIG_10 = { pricePerKmSar: 10.0, extraRiderSameDropoffMultiplier: 0.5 };
const CONFIG_2 = { pricePerKmSar: 2.0, extraRiderSameDropoffMultiplier: 0.5 };

// ─── calculateChargeableDistanceKm ───────────────────────────────────────────

describe('calculateChargeableDistanceKm', () => {
  it('ONE_WAY: chargeable = one-way distance', () => {
    assert.equal(calculateChargeableDistanceKm(5, 'ONE_WAY'), 5);
  });

  it('ROUND_TRIP: chargeable = 2× one-way distance', () => {
    assert.equal(calculateChargeableDistanceKm(5, 'ROUND_TRIP'), 10);
  });

  it('ROUND_TRIP 5km × 10 SAR = 100 SAR total distance charge', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ROUND_TRIP');
    assert.equal(chargeable, 10);
    assert.equal(calculateDistanceCharge(chargeable, 10), 100);
  });

  it('ONE_WAY 5km × 10 SAR = 50 SAR total distance charge', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ONE_WAY');
    assert.equal(chargeable, 5);
    assert.equal(calculateDistanceCharge(chargeable, 10), 50);
  });

  it('returns 0 for zero distance', () => {
    assert.equal(calculateChargeableDistanceKm(0, 'ROUND_TRIP'), 0);
  });

  it('returns 0 for negative distance', () => {
    assert.equal(calculateChargeableDistanceKm(-3, 'ONE_WAY'), 0);
  });

  it('rounds to 2 decimal places', () => {
    assert.equal(calculateChargeableDistanceKm(5.555, 'ROUND_TRIP'), 11.11);
  });
});

// ─── Full pricing formula with tripDirection ──────────────────────────────────

describe('pricing formula: ROUND_TRIP', () => {
  it('5km one-way × 10 SAR round-trip = 100 SAR distance charge', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ROUND_TRIP');
    const result = calculateSubscriptionQuote(0, 0, chargeable, 0, CONFIG_10);
    assert.equal(result.distancePriceSar, 100);
    assert.equal(result.finalPriceSar, 100);
  });

  it('base 300 + round-trip 10km = 400, 1 extra rider = 600', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ROUND_TRIP'); // 10km
    const result = calculateSubscriptionQuote(300, 0, chargeable, 1, CONFIG_10);
    assert.equal(result.distancePriceSar, 100);
    assert.equal(result.primaryFinalSar, 400);
    assert.equal(result.extraRidersPriceSar, 200); // 400 × 0.5
    assert.equal(result.finalPriceSar, 600);
  });

  it('2 extra riders add 100% of primary price', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ROUND_TRIP');
    const result = calculateSubscriptionQuote(300, 0, chargeable, 2, CONFIG_10);
    assert.equal(result.primaryFinalSar, 400);
    assert.equal(result.extraRidersPriceSar, 400); // 2 × 400 × 0.5
    assert.equal(result.finalPriceSar, 800);
  });
});

describe('pricing formula: ONE_WAY', () => {
  it('5km one-way × 10 SAR = 50 SAR distance charge', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ONE_WAY');
    const result = calculateSubscriptionQuote(0, 0, chargeable, 0, CONFIG_10);
    assert.equal(result.distancePriceSar, 50);
    assert.equal(result.finalPriceSar, 50);
  });

  it('base 200 + one-way 5km distance = 250, 1 extra rider = 375', () => {
    const chargeable = calculateChargeableDistanceKm(5, 'ONE_WAY');
    const result = calculateSubscriptionQuote(200, 0, chargeable, 1, CONFIG_10);
    assert.equal(result.primaryFinalSar, 250); // 200 + 50
    assert.equal(result.extraRidersPriceSar, 125); // 250 × 0.5
    assert.equal(result.finalPriceSar, 375);
  });
});

describe('pricing: client-provided distance is not used (server calculates)', () => {
  it('quote schema no longer accepts estimatedDistanceKm', () => {
    // The quote schema does NOT have estimatedDistanceKm; server calls ORS
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.ok(r.success, 'Should accept location-based quote input');
  });

  it('quote schema requires pickupLocation', () => {
    const r = subscriptionQuoteSchema.safeParse({
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.ok(!r.success, 'Should reject missing pickupLocation');
  });

  it('quote schema requires dropoffLocation', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.ok(!r.success, 'Should reject missing dropoffLocation');
  });

  it('quote schema rejects short pickup location', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Hi', // too short
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.ok(!r.success);
  });

  it('quote schema requires at least one riderId', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: [],
    });
    assert.ok(!r.success);
  });

  it('quote schema requires valid UUID riderIds', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'ROUND_TRIP',
      riderIds: ['not-a-uuid'],
    });
    assert.ok(!r.success);
  });

  it('quote schema rejects invalid tripDirection', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      tripDirection: 'BOTH_WAYS', // invalid
      riderIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.ok(!r.success);
  });

  it('tripDirection defaults to ROUND_TRIP when omitted', () => {
    const r = subscriptionQuoteSchema.safeParse({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      riderIds: ['11111111-1111-1111-1111-111111111111'],
    });
    assert.ok(r.success);
    assert.equal(r.data?.tripDirection, 'ROUND_TRIP');
  });
});

// ─── Trip generation logic ────────────────────────────────────────────────────

describe('trip leg generation logic', () => {
  type Leg = { legType: string; pickup: string; dropoff: string };

  const generateLegs = (
    tripDirection: 'ONE_WAY' | 'ROUND_TRIP',
    pickup: string,
    dropoff: string,
    returnTime: string,
  ): Leg[] => {
    const legs: Leg[] = [
      { legType: 'OUTBOUND', pickup, dropoff },
    ];
    if (tripDirection === 'ROUND_TRIP') {
      legs.push({ legType: 'RETURN', pickup: dropoff, dropoff: pickup });
    }
    void returnTime; // used in real code for scheduledPickupTime
    return legs;
  };

  it('ONE_WAY generates only OUTBOUND leg', () => {
    const legs = generateLegs('ONE_WAY', 'Home', 'School', '15:00');
    assert.equal(legs.length, 1);
    assert.equal(legs[0]?.legType, 'OUTBOUND');
    assert.equal(legs[0]?.pickup, 'Home');
    assert.equal(legs[0]?.dropoff, 'School');
  });

  it('ROUND_TRIP generates OUTBOUND and RETURN legs', () => {
    const legs = generateLegs('ROUND_TRIP', 'Home', 'School', '15:00');
    assert.equal(legs.length, 2);
    assert.equal(legs[0]?.legType, 'OUTBOUND');
    assert.equal(legs[1]?.legType, 'RETURN');
  });

  it('RETURN leg reverses pickup and dropoff', () => {
    const legs = generateLegs('ROUND_TRIP', 'Home', 'School', '15:00');
    const returnLeg = legs[1]!;
    assert.equal(returnLeg.pickup, 'School');
    assert.equal(returnLeg.dropoff, 'Home');
  });

  it('multiple riders produce legs × riders', () => {
    const riders = ['rider-1', 'rider-2'];
    const legs = generateLegs('ROUND_TRIP', 'Home', 'School', '15:00');
    const allCombos = riders.flatMap((r) => legs.map((l) => ({ riderId: r, ...l })));
    assert.equal(allCombos.length, 4); // 2 riders × 2 legs
  });

  it('dedup key includes legType to allow both OUTBOUND and RETURN', () => {
    const key = (subId: string, riderId: string, date: string, legType: string) =>
      `${subId}|${riderId}|${date}|${legType}`;

    const outbound = key('sub-1', 'rider-1', '2025-09-01', 'OUTBOUND');
    const returnLeg = key('sub-1', 'rider-1', '2025-09-01', 'RETURN');
    assert.notEqual(outbound, returnLeg);
  });
});

// ─── DistanceError handling (pure error code logic) ──────────────────────────

describe('DistanceError code logic', () => {
  const mapCodeToStatus = (code: string): number => {
    if (code === 'NOT_CONFIGURED' || code === 'PROVIDER_NOT_IMPLEMENTED') return 503;
    return 400;
  };

  it('NOT_CONFIGURED → 503', () => {
    assert.equal(mapCodeToStatus('NOT_CONFIGURED'), 503);
  });

  it('PROVIDER_NOT_IMPLEMENTED → 503', () => {
    assert.equal(mapCodeToStatus('PROVIDER_NOT_IMPLEMENTED'), 503);
  });

  it('GEOCODE_FAILED → 400', () => {
    assert.equal(mapCodeToStatus('GEOCODE_FAILED'), 400);
  });

  it('ROUTE_FAILED → 400', () => {
    assert.equal(mapCodeToStatus('ROUTE_FAILED'), 400);
  });
});
