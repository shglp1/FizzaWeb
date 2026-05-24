/**
 * Dispatch feasibility, idempotency, cron auth, and board classification tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkTimelineFeasibilitySync,
  estimateLegDurationMinutes,
  estimateTravelMinutesSync,
  resolveTravelMinutes,
} from '../lib/dispatch/feasibility.ts';
import { resolveDispatchDecision } from '../lib/dispatch/dispatchDecision.ts';
import {
  buildTripDuplicateWhere,
  isDuplicateTripGeneration,
  shouldNotifyGenerationReport,
  shouldTriggerTripGenerationAfterPayment,
} from '../lib/dispatch/idempotency.ts';
import { isAuthorizedCronRequest } from '../lib/cron/cronAuth.ts';
import { classifyTripForBoard } from '../lib/ui/adminOperations.ts';

const config = {
  bufferMinutes: 15,
  defaultLegDurationMinutes: 60,
  defaultTravelMinutesNoCoords: 20,
  averageFallbackSpeedKmh: 30,
  generationHorizonDays: 14,
};

describe('dispatch feasibility', () => {
  it('allows sequential trips with enough gap (feasible back-to-back)', () => {
    const base = new Date('2026-06-01T08:00:00');
    const trips = [
      {
        id: 'a',
        scheduledPickupTime: base,
        scheduledDropoffTime: new Date('2026-06-01T08:45:00'),
        pickupLat: 24.47, pickupLng: 39.61,
        dropoffLat: 24.48, dropoffLng: 39.62,
      },
      {
        id: 'b',
        scheduledPickupTime: new Date('2026-06-01T10:00:00'),
        scheduledDropoffTime: null,
        pickupLat: 24.49, pickupLng: 39.63,
        dropoffLat: 24.50, dropoffLng: 39.64,
      },
    ];
    const result = checkTimelineFeasibilitySync(trips, config);
    assert.equal(result.feasible, true);
  });

  it('flags 8:00 + 9:00 conflict with leg duration, travel, and buffer', () => {
    const trips = [
      {
        id: 'a',
        scheduledPickupTime: new Date('2026-06-01T08:00:00'),
        scheduledDropoffTime: null,
        pickupLat: 24.47, pickupLng: 39.61,
        dropoffLat: 24.55, dropoffLng: 39.70,
        legDurationMinutes: 50,
      },
      {
        id: 'b',
        scheduledPickupTime: new Date('2026-06-01T09:00:00'),
        scheduledDropoffTime: null,
        pickupLat: 24.60, pickupLng: 39.80,
        dropoffLat: 24.61, dropoffLng: 39.81,
      },
    ];
    const result = checkTimelineFeasibilitySync(trips, config);
    assert.equal(result.feasible, false);
    assert.ok(result.issues.some((i) => i.tripId === 'b'));
    assert.match(result.issues[0]!.message, /extra min/);
  });

  it('includes dispatchBufferMinutes in readiness calculation', () => {
    const prior = {
      id: 'a',
      scheduledPickupTime: new Date('2026-06-01T08:00:00'),
      scheduledDropoffTime: new Date('2026-06-01T08:30:00'),
      pickupLat: 24.47, pickupLng: 39.61,
      dropoffLat: 24.47, dropoffLng: 39.61,
    };
    const next = {
      id: 'b',
      scheduledPickupTime: new Date('2026-06-01T08:44:00'),
      scheduledDropoffTime: null,
      pickupLat: 24.47, pickupLng: 39.61,
      dropoffLat: 24.48, dropoffLng: 39.62,
    };
    const tightBuffer = checkTimelineFeasibilitySync([prior, next], { ...config, bufferMinutes: 15 });
    const looseBuffer = checkTimelineFeasibilitySync([prior, next], { ...config, bufferMinutes: 0 });
    assert.equal(tightBuffer.feasible, false);
    assert.equal(looseBuffer.feasible, true);
  });

  it('estimates leg duration from scheduled times', () => {
    const mins = estimateLegDurationMinutes({
      id: 'x',
      scheduledPickupTime: new Date('2026-06-01T08:00:00'),
      scheduledDropoffTime: new Date('2026-06-01T08:30:00'),
      pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null,
    }, config);
    assert.equal(mins, 30);
  });

  it('uses defaultTravelMinutesNoCoords when coordinates missing', () => {
    const from = {
      id: 'a',
      scheduledPickupTime: new Date('2026-06-01T08:00:00'),
      pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null,
    };
    const to = {
      id: 'b',
      scheduledPickupTime: new Date('2026-06-01T09:00:00'),
      pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null,
    };
    assert.equal(estimateTravelMinutesSync(from, to, config), config.defaultTravelMinutesNoCoords);
  });

  it('falls back to haversine when ORS is unavailable', () => {
    const haversine = 18;
    assert.equal(
      resolveTravelMinutes({
        orsMinutes: null,
        haversineMinutes: haversine,
        noCoordsDefault: config.defaultTravelMinutesNoCoords,
        hasCoords: true,
      }),
      haversine,
    );
    assert.equal(
      resolveTravelMinutes({
        orsMinutes: 22,
        haversineMinutes: haversine,
        noCoordsDefault: config.defaultTravelMinutesNoCoords,
        hasCoords: true,
      }),
      22,
    );
  });
});

describe('dispatch decision', () => {
  it('marks needsDispatch when default driver timeline is infeasible', async () => {
    const existing = [{
      id: 'existing',
      scheduledPickupTime: new Date('2026-06-01T08:00:00'),
      scheduledDropoffTime: null,
      pickupLat: 24.47, pickupLng: 39.61,
      dropoffLat: 24.55, dropoffLng: 39.70,
      legDurationMinutes: 50,
    }];
    const candidate = {
      id: 'new',
      scheduledPickupTime: new Date('2026-06-01T09:00:00'),
      scheduledDropoffTime: null,
      pickupLat: 24.60, pickupLng: 39.80,
      dropoffLat: 24.61, dropoffLng: 39.81,
    };
    const decision = await resolveDispatchDecision({
      driverId: 'driver-1',
      driverAvailable: true,
      candidate,
      existingTimeline: existing,
      config,
    });
    assert.equal(decision.assignDriver, false);
    assert.equal(decision.needsDispatch, true);
    assert.equal(decision.status, 'SCHEDULED');
    assert.equal(decision.driverId, null);
    assert.ok(decision.dispatchNote);
  });

  it('simulates manual assign 409 conflict message', async () => {
    const decision = await resolveDispatchDecision({
      driverId: 'driver-1',
      driverAvailable: true,
      candidate: {
        id: 'trip-1',
        scheduledPickupTime: new Date('2026-06-01T09:00:00'),
        scheduledDropoffTime: null,
        pickupLat: 24.60, pickupLng: 39.80,
        dropoffLat: 24.61, dropoffLng: 39.81,
      },
      existingTimeline: [{
        id: 'other-sub-trip',
        scheduledPickupTime: new Date('2026-06-01T08:00:00'),
        scheduledDropoffTime: null,
        pickupLat: 24.47, pickupLng: 39.61,
        dropoffLat: 24.55, dropoffLng: 39.70,
        legDurationMinutes: 50,
      }],
      config,
    });
    assert.equal(decision.assignDriver, false);
    const apiMessage = decision.dispatchNote ?? 'Driver timeline conflict — choose another driver or adjust schedule';
    assert.match(apiMessage, /cannot reach|extra min|Timeline conflict/i);
  });
});

describe('dispatch idempotency', () => {
  it('builds duplicate lookup key for subscription/rider/date/leg', () => {
    const where = buildTripDuplicateWhere({
      subscriptionId: 'sub-1',
      riderId: 'rider-1',
      scheduledDate: new Date('2026-06-01'),
      legType: 'OUTBOUND',
    });
    assert.equal(where.subscriptionId, 'sub-1');
    assert.equal(where.riderId, 'rider-1');
    assert.equal(where.legType, 'OUTBOUND');
  });

  it('detects duplicate generation when trip already exists', () => {
    assert.equal(isDuplicateTripGeneration({ id: 'trip-1' }), true);
    assert.equal(isDuplicateTripGeneration(null), false);
  });

  it('skips payment replay trip generation when subscription was not newly activated', () => {
    assert.equal(shouldTriggerTripGenerationAfterPayment(false, 'sub-1'), false);
    assert.equal(shouldTriggerTripGenerationAfterPayment(true, 'sub-1'), true);
    assert.equal(shouldTriggerTripGenerationAfterPayment(true, null), false);
  });

  it('suppresses generation report when duplicate run creates nothing new', () => {
    assert.equal(shouldNotifyGenerationReport({ generatedCount: 0, needsDispatchCount: 0 }), false);
    assert.equal(shouldNotifyGenerationReport({ generatedCount: 0, needsDispatchCount: 2 }), true);
    assert.equal(shouldNotifyGenerationReport({ generatedCount: 5, needsDispatchCount: 0 }), true);
  });
});

describe('cron security', () => {
  it('rejects missing or wrong bearer token', () => {
    assert.equal(isAuthorizedCronRequest(null, 'secret'), false);
    assert.equal(isAuthorizedCronRequest('Bearer wrong', 'secret'), false);
    assert.equal(isAuthorizedCronRequest('Bearer secret', ''), false);
    assert.equal(isAuthorizedCronRequest('Bearer secret', 'secret'), true);
  });
});

describe('dispatch board classification', () => {
  it('routes needsDispatch trips to attention column', () => {
    assert.equal(
      classifyTripForBoard({ status: 'SCHEDULED', driver: null, needsDispatch: true }),
      'attention',
    );
  });
});
