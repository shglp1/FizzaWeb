/**
 * Task 12.1 smoke tests — production readiness helpers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDisplayLabel,
  mapInternalToDisplay,
  getAllowedActions,
  deriveApproachingDisplay,
} from '../lib/trips/statusCatalog.ts';

import {
  canParentAccessTrip,
  canDriverAccessTrip,
  canDriverUpdateLocation,
  canSendChat,
  isCompleteBeforePickupAttempt,
} from '../lib/trips/tripAuth.ts';

import { shouldTriggerNearEvent } from '../lib/trips/tripEta.ts';
import { estimateDurationMinutesFallback } from '../lib/maps/distance.ts';
import {
  isTripLateForDriver,
  buildLateCandidate,
} from '../lib/trips/tripLateDetection.ts';

import { validateImageUpload, getMaxUploadBytes } from '../lib/storage/localUpload.ts';

describe('statusCatalog', () => {
  it('maps PRE_TRIP to PRE_TRIP_TRACKING display', () => {
    assert.strictEqual(mapInternalToDisplay('PRE_TRIP'), 'PRE_TRIP_TRACKING');
    assert.strictEqual(getDisplayLabel('PRE_TRIP'), 'Pre-Trip Tracking');
  });

  it('maps ON_THE_WAY to EN_ROUTE_TO_PICKUP', () => {
    assert.strictEqual(mapInternalToDisplay('ON_THE_WAY'), 'EN_ROUTE_TO_PICKUP');
  });

  it('derives ARRIVING_PICKUP when near', () => {
    assert.strictEqual(
      deriveApproachingDisplay('ON_THE_WAY', { nearPickup: true }),
      'ARRIVING_PICKUP',
    );
  });

  it('driver allowed actions from catalog', () => {
    assert.ok(getAllowedActions('ARRIVED_PICKUP', 'DRIVER').includes('PICKED_UP'));
  });
});

describe('tripAuth', () => {
  const base = {
    tripId: 't1',
    tripDriverProfileId: 'driver-1',
    parentUserId: 'parent-1',
    riderParentId: null,
    status: 'ON_THE_WAY' as const,
    scheduledPickupTime: new Date(Date.now() + 5 * 60 * 1000),
    chatOpenedAt: new Date(),
    chatClosedAt: null,
    tripEndedAt: null,
  };

  it('parent cannot access other parent trip', () => {
    assert.ok(!canParentAccessTrip(base, 'other-parent'));
  });

  it('driver cannot update unassigned trip location', () => {
    assert.ok(!canDriverUpdateLocation(base, 'wrong-driver'));
  });

  it('blocked chat user cannot send', () => {
    const r = canSendChat(base, 'parent-1', 'PARENT', true);
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, 'CHAT_BLOCKED');
  });

  it('complete before pickup rejected', () => {
    assert.ok(isCompleteBeforePickupAttempt('ON_THE_WAY', 'COMPLETED'));
  });

  it('assigned driver can access trip', () => {
    assert.ok(canDriverAccessTrip(base, 'driver-1'));
  });
});

describe('tripEta', () => {
  it('triggers near when ETA under threshold', () => {
    assert.ok(shouldTriggerNearEvent(4, 500, 5, 100));
  });

  it('triggers near when distance under threshold', () => {
    assert.ok(shouldTriggerNearEvent(10, 80, 5, 100));
  });

  it('fallback duration from distance', () => {
    const mins = estimateDurationMinutesFallback(5000, 30);
    assert.ok(mins > 0 && mins < 20);
  });
});

describe('tripLateDetection', () => {
  const config = {
    etaNearThresholdMinutes: 5,
    pickupNearThresholdMeters: 100,
    dropoffNearThresholdMeters: 100,
    averageFallbackSpeedKmh: 30,
    notificationCooldownMinutes: 10,
    driverLateAfterMinutes: 10,
  };

  it('detects late when pickup passed', () => {
    const pickup = new Date(Date.now() - 20 * 60 * 1000);
    assert.ok(isTripLateForDriver('ON_THE_WAY', pickup, Date.now(), config));
  });

  it('does not flag late after arrived pickup', () => {
    const pickup = new Date(Date.now() - 20 * 60 * 1000);
    assert.ok(!isTripLateForDriver('ARRIVED_PICKUP', pickup, Date.now(), config));
  });

  it('buildLateCandidate returns trip when late', () => {
    const c = buildLateCandidate(
      { id: 'x', status: 'ON_THE_WAY', scheduledPickupTime: new Date(Date.now() - 20 * 60 * 1000) },
      Date.now(),
      config,
    );
    assert.ok(c);
    assert.strictEqual(c!.tripId, 'x');
  });
});

describe('localUpload validation', () => {
  it('accepts jpeg', () => {
    const r = validateImageUpload('image/jpeg', 1024);
    assert.ok(r.ok);
  });

  it('rejects pdf', () => {
    const r = validateImageUpload('application/pdf', 1024);
    assert.ok(!r.ok);
  });

  it('rejects oversize', () => {
    const r = validateImageUpload('image/png', getMaxUploadBytes() + 1);
    assert.ok(!r.ok);
  });
});
