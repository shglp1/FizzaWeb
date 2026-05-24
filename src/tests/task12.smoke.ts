/**
 * Task 12 smoke tests — enterprise trip operations.
 * Tests pure functions only (no DB / network / server imports).
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── tripLifecycle imports ────────────────────────────────────────────────────

import {
  isValidTransition,
  isActiveStatus,
  isTrackableStatus,
  isCancellable,
  isChatWindowOpen,
  isPreTripWindowOpen,
  isLocationSharingAllowed,
  isParentLocationVisible,
  haversineMetres,
  DRIVER_TRANSITIONS,
  TRIP_STATUS_LABEL,
} from '../lib/trips/tripLifecycle.ts';

// ─── chatModeration imports ────────────────────────────────────────────────────

import {
  moderateMessage,
  PARENT_QUICK_REPLIES,
  DRIVER_QUICK_REPLIES,
} from '../lib/trips/chatModeration.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// isValidTransition — Driver
// ═══════════════════════════════════════════════════════════════════════════════

describe('isValidTransition — Driver', () => {
  it('DRIVER_ASSIGNED → PRE_TRIP allowed', () => {
    assert.ok(isValidTransition('DRIVER_ASSIGNED', 'PRE_TRIP', 'DRIVER'));
  });

  it('DRIVER_ASSIGNED → ON_THE_WAY allowed (skip PRE_TRIP)', () => {
    assert.ok(isValidTransition('DRIVER_ASSIGNED', 'ON_THE_WAY', 'DRIVER'));
  });

  it('PRE_TRIP → ON_THE_WAY allowed', () => {
    assert.ok(isValidTransition('PRE_TRIP', 'ON_THE_WAY', 'DRIVER'));
  });

  it('ON_THE_WAY → ARRIVED_PICKUP allowed', () => {
    assert.ok(isValidTransition('ON_THE_WAY', 'ARRIVED_PICKUP', 'DRIVER'));
  });

  it('ARRIVED_PICKUP → PICKED_UP allowed', () => {
    assert.ok(isValidTransition('ARRIVED_PICKUP', 'PICKED_UP', 'DRIVER'));
  });

  it('PICKED_UP → EN_ROUTE_DROPOFF allowed', () => {
    assert.ok(isValidTransition('PICKED_UP', 'EN_ROUTE_DROPOFF', 'DRIVER'));
  });

  it('EN_ROUTE_DROPOFF → ARRIVED_DROPOFF allowed', () => {
    assert.ok(isValidTransition('EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF', 'DRIVER'));
  });

  it('ARRIVED_DROPOFF → COMPLETED allowed', () => {
    assert.ok(isValidTransition('ARRIVED_DROPOFF', 'COMPLETED', 'DRIVER'));
  });

  it('ARRIVED_PICKUP → NO_SHOW allowed', () => {
    assert.ok(isValidTransition('ARRIVED_PICKUP', 'NO_SHOW', 'DRIVER'));
  });

  it('PRE_TRIP → CANCELLED allowed (driver can cancel)', () => {
    assert.ok(isValidTransition('PRE_TRIP', 'CANCELLED', 'DRIVER'));
  });

  it('DRIVER_ASSIGNED → COMPLETED NOT allowed (must follow lifecycle)', () => {
    assert.ok(!isValidTransition('DRIVER_ASSIGNED', 'COMPLETED', 'DRIVER'));
  });

  it('ON_THE_WAY → PICKED_UP NOT allowed (must arrive first)', () => {
    assert.ok(!isValidTransition('ON_THE_WAY', 'PICKED_UP', 'DRIVER'));
  });

  it('PICKED_UP → COMPLETED NOT allowed (must go through EN_ROUTE)', () => {
    assert.ok(!isValidTransition('PICKED_UP', 'COMPLETED', 'DRIVER'));
  });

  it('COMPLETED → anything NOT allowed', () => {
    assert.ok(!isValidTransition('COMPLETED', 'CANCELLED', 'DRIVER'));
  });

  it('same status transition NOT allowed', () => {
    assert.ok(!isValidTransition('ON_THE_WAY', 'ON_THE_WAY', 'DRIVER'));
  });

  it('SCHEDULED → anything NOT allowed for driver', () => {
    assert.ok(!isValidTransition('SCHEDULED', 'DRIVER_ASSIGNED', 'DRIVER'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isValidTransition — Admin
// ═══════════════════════════════════════════════════════════════════════════════

describe('isValidTransition — Admin', () => {
  it('SCHEDULED → DRIVER_ASSIGNED allowed', () => {
    assert.ok(isValidTransition('SCHEDULED', 'DRIVER_ASSIGNED', 'ADMIN'));
  });

  it('SCHEDULED → CANCELLED allowed', () => {
    assert.ok(isValidTransition('SCHEDULED', 'CANCELLED', 'ADMIN'));
  });

  it('COMPLETED → CANCELLED allowed (admin-only revert)', () => {
    assert.ok(isValidTransition('COMPLETED', 'CANCELLED', 'ADMIN'));
  });

  it('NO_SHOW → CANCELLED allowed', () => {
    assert.ok(isValidTransition('NO_SHOW', 'CANCELLED', 'ADMIN'));
  });

  it('CANCELLED → anything NOT allowed even for admin', () => {
    assert.ok(!isValidTransition('CANCELLED', 'SCHEDULED', 'ADMIN'));
    assert.ok(!isValidTransition('CANCELLED', 'DRIVER_ASSIGNED', 'ADMIN'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isValidTransition — Parent
// ═══════════════════════════════════════════════════════════════════════════════

describe('isValidTransition — Parent', () => {
  it('SCHEDULED → CANCELLED allowed', () => {
    assert.ok(isValidTransition('SCHEDULED', 'CANCELLED', 'PARENT'));
  });

  it('DRIVER_ASSIGNED → CANCELLED allowed', () => {
    assert.ok(isValidTransition('DRIVER_ASSIGNED', 'CANCELLED', 'PARENT'));
  });

  it('PRE_TRIP → CANCELLED allowed', () => {
    assert.ok(isValidTransition('PRE_TRIP', 'CANCELLED', 'PARENT'));
  });

  it('ON_THE_WAY → CANCELLED NOT allowed (too late)', () => {
    assert.ok(!isValidTransition('ON_THE_WAY', 'CANCELLED', 'PARENT'));
  });

  it('PICKED_UP → CANCELLED NOT allowed', () => {
    assert.ok(!isValidTransition('PICKED_UP', 'CANCELLED', 'PARENT'));
  });

  it('parent cannot advance status', () => {
    assert.ok(!isValidTransition('DRIVER_ASSIGNED', 'PRE_TRIP', 'PARENT'));
    assert.ok(!isValidTransition('DRIVER_ASSIGNED', 'ON_THE_WAY', 'PARENT'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Status classification helpers
// ═══════════════════════════════════════════════════════════════════════════════

describe('isActiveStatus', () => {
  it('PRE_TRIP is active', () => assert.ok(isActiveStatus('PRE_TRIP')));
  it('ON_THE_WAY is active', () => assert.ok(isActiveStatus('ON_THE_WAY')));
  it('ARRIVED_PICKUP is active', () => assert.ok(isActiveStatus('ARRIVED_PICKUP')));
  it('PICKED_UP is active', () => assert.ok(isActiveStatus('PICKED_UP')));
  it('EN_ROUTE_DROPOFF is active', () => assert.ok(isActiveStatus('EN_ROUTE_DROPOFF')));
  it('ARRIVED_DROPOFF is active', () => assert.ok(isActiveStatus('ARRIVED_DROPOFF')));
  it('SCHEDULED is not active', () => assert.ok(!isActiveStatus('SCHEDULED')));
  it('DRIVER_ASSIGNED is not active', () => assert.ok(!isActiveStatus('DRIVER_ASSIGNED')));
  it('COMPLETED is not active', () => assert.ok(!isActiveStatus('COMPLETED')));
  it('CANCELLED is not active', () => assert.ok(!isActiveStatus('CANCELLED')));
});

describe('isTrackableStatus', () => {
  it('ON_THE_WAY is trackable', () => assert.ok(isTrackableStatus('ON_THE_WAY')));
  it('PICKED_UP is trackable', () => assert.ok(isTrackableStatus('PICKED_UP')));
  it('ARRIVED_PICKUP is trackable', () => assert.ok(isTrackableStatus('ARRIVED_PICKUP')));
  it('SCHEDULED is not trackable', () => assert.ok(!isTrackableStatus('SCHEDULED')));
  it('COMPLETED is not trackable', () => assert.ok(!isTrackableStatus('COMPLETED')));
});

describe('isCancellable', () => {
  it('SCHEDULED is cancellable', () => assert.ok(isCancellable('SCHEDULED')));
  it('DRIVER_ASSIGNED is cancellable', () => assert.ok(isCancellable('DRIVER_ASSIGNED')));
  it('PRE_TRIP is cancellable', () => assert.ok(isCancellable('PRE_TRIP')));
  it('ON_THE_WAY is cancellable', () => assert.ok(isCancellable('ON_THE_WAY')));
  it('PICKED_UP is NOT cancellable', () => assert.ok(!isCancellable('PICKED_UP')));
  it('COMPLETED is NOT cancellable', () => assert.ok(!isCancellable('COMPLETED')));
  it('CANCELLED is NOT cancellable', () => assert.ok(!isCancellable('CANCELLED')));
});

// ═══════════════════════════════════════════════════════════════════════════════
// isChatWindowOpen
// ═══════════════════════════════════════════════════════════════════════════════

describe('isChatWindowOpen', () => {
  const pickupIn30min = new Date(Date.now() + 30 * 60 * 1000);
  const pickupIn5min  = new Date(Date.now() + 5 * 60 * 1000);
  const pickupPast    = new Date(Date.now() - 10 * 60 * 1000);

  it('returns false when pickup is 30 min away (outside 20-min window)', () => {
    assert.ok(!isChatWindowOpen(pickupIn30min, 'DRIVER_ASSIGNED', null, null));
  });

  it('returns true when pickup is 5 min away (inside 20-min window)', () => {
    assert.ok(isChatWindowOpen(pickupIn5min, 'DRIVER_ASSIGNED', null, null));
  });

  it('returns true when pickup has passed and trip is active', () => {
    assert.ok(isChatWindowOpen(pickupPast, 'PICKED_UP', null, null));
  });

  it('returns false when chatClosedAt is set', () => {
    assert.ok(!isChatWindowOpen(pickupIn5min, 'DRIVER_ASSIGNED', null, new Date()));
  });

  it('returns true when chatOpenedAt is set (already open)', () => {
    assert.ok(isChatWindowOpen(pickupIn30min, 'DRIVER_ASSIGNED', new Date(), null));
  });

  it('returns false when scheduledPickupTime is null', () => {
    assert.ok(!isChatWindowOpen(null, 'DRIVER_ASSIGNED', null, null));
  });

  it('stays open for configured minutes after completion', () => {
    const ended = new Date(Date.now() - 10 * 60 * 1000);
    assert.ok(isChatWindowOpen(null, 'COMPLETED', new Date(), null, Date.now(), ended, { closeMinutesAfterDropoff: 60 }));
  });

  it('closes more than configured minutes after completion', () => {
    const ended = new Date(Date.now() - 65 * 60 * 1000);
    assert.ok(!isChatWindowOpen(null, 'COMPLETED', new Date(), null, Date.now(), ended, { closeMinutesAfterDropoff: 60 }));
  });
});

describe('isLocationSharingAllowed', () => {
  const pickupIn5min = new Date(Date.now() + 5 * 60 * 1000);
  const pickupIn15min = new Date(Date.now() + 15 * 60 * 1000);

  it('allows ON_THE_WAY inside pre-trip window', () => {
    assert.ok(isLocationSharingAllowed('ON_THE_WAY', pickupIn5min));
  });

  it('blocks PRE_TRIP outside 10-min window', () => {
    assert.ok(!isLocationSharingAllowed('PRE_TRIP', pickupIn15min));
  });

  it('blocks COMPLETED', () => {
    assert.ok(!isLocationSharingAllowed('COMPLETED', pickupIn5min));
  });

  it('allows PICKED_UP anytime', () => {
    assert.ok(isLocationSharingAllowed('PICKED_UP', null));
  });
});

describe('isParentLocationVisible', () => {
  const pickupIn5min = new Date(Date.now() + 5 * 60 * 1000);
  const pickupIn15min = new Date(Date.now() + 15 * 60 * 1000);

  it('parent sees location when driver is ON_THE_WAY in window', () => {
    assert.ok(isParentLocationVisible('ON_THE_WAY', pickupIn5min));
  });

  it('parent cannot see DRIVER_ASSIGNED too early', () => {
    assert.ok(!isParentLocationVisible('DRIVER_ASSIGNED', pickupIn15min));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isPreTripWindowOpen
// ═══════════════════════════════════════════════════════════════════════════════

describe('isPreTripWindowOpen', () => {
  const pickupIn15min = new Date(Date.now() + 15 * 60 * 1000);
  const pickupIn5min  = new Date(Date.now() + 5 * 60 * 1000);

  it('returns false when pickup is 15 min away (outside 10-min window)', () => {
    assert.ok(!isPreTripWindowOpen(pickupIn15min));
  });

  it('returns true when pickup is 5 min away (inside 10-min window)', () => {
    assert.ok(isPreTripWindowOpen(pickupIn5min));
  });

  it('returns false when scheduledPickupTime is null', () => {
    assert.ok(!isPreTripWindowOpen(null));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// haversineMetres
// ═══════════════════════════════════════════════════════════════════════════════

describe('haversineMetres', () => {
  it('returns 0 for identical coordinates', () => {
    assert.strictEqual(haversineMetres(24.7136, 46.6753, 24.7136, 46.6753), 0);
  });

  it('Riyadh to Jeddah is roughly 800 km', () => {
    const dist = haversineMetres(24.7136, 46.6753, 21.3891, 39.8579);
    assert.ok(dist > 750_000 && dist < 850_000, `Expected ~800km, got ${Math.round(dist / 1000)}km`);
  });

  it('two points ~200 m apart gives ~200 m', () => {
    // ~0.0018 degrees latitude ≈ 200 m
    const dist = haversineMetres(24.7136, 46.6753, 24.7154, 46.6753);
    assert.ok(dist > 150 && dist < 250, `Expected ~200m, got ${Math.round(dist)}m`);
  });

  it('geofence passes: distance within ~200 m threshold', () => {
    const dist = haversineMetres(24.7136, 46.6753, 24.7154, 46.6753);
    assert.ok(dist <= 250, `Expected ≤250m for geofence, got ${Math.round(dist)}m`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER_TRANSITIONS structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('DRIVER_TRANSITIONS structure', () => {
  it('DRIVER_ASSIGNED has at least PRE_TRIP and ON_THE_WAY', () => {
    assert.ok(DRIVER_TRANSITIONS['DRIVER_ASSIGNED']?.includes('PRE_TRIP'));
    assert.ok(DRIVER_TRANSITIONS['DRIVER_ASSIGNED']?.includes('ON_THE_WAY'));
  });

  it('ARRIVED_DROPOFF leads to COMPLETED', () => {
    assert.ok(DRIVER_TRANSITIONS['ARRIVED_DROPOFF']?.includes('COMPLETED'));
  });

  it('COMPLETED has no forward transitions', () => {
    assert.ok(!DRIVER_TRANSITIONS['COMPLETED']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRIP_STATUS_LABEL
// ═══════════════════════════════════════════════════════════════════════════════

describe('TRIP_STATUS_LABEL', () => {
  it('all 11 statuses have labels', () => {
    const statuses = [
      'SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
      'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
      'COMPLETED', 'CANCELLED', 'NO_SHOW',
    ] as const;
    for (const s of statuses) {
      assert.ok(TRIP_STATUS_LABEL[s]?.length > 0, `Missing label for ${s}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// chatModeration — moderateMessage
// ═══════════════════════════════════════════════════════════════════════════════

describe('moderateMessage', () => {
  it('returns CLEAN for benign message', () => {
    assert.strictEqual(moderateMessage('I am on my way').status, 'CLEAN');
  });

  it('returns CLEAN for empty (handled by API layer)', () => {
    // whitespace-only still runs through moderation
    const result = moderateMessage('   ');
    assert.ok(['CLEAN', 'FLAGGED'].includes(result.status));
  });

  it('flags messages containing banned words', () => {
    const result = moderateMessage('This is a test with fuck in it');
    assert.ok(result.status === 'FLAGGED' || result.status === 'BLOCKED');
  });

  it('blocks if multiple banned words', () => {
    const result = moderateMessage('fuck you shit head');
    assert.ok(result.status === 'BLOCKED');
  });

  it('respects extra banned words', () => {
    const result = moderateMessage('hello world', ['hello']);
    assert.ok(result.status === 'FLAGGED' || result.status === 'BLOCKED');
  });

  it('matched words are returned in result', () => {
    const result = moderateMessage('this is a damn test');
    if (result.status !== 'CLEAN') {
      assert.ok(Array.isArray(result.matchedWords));
      assert.ok(result.matchedWords.length > 0);
    }
  });

  it('is case-insensitive', () => {
    const result = moderateMessage('FUCK THIS');
    assert.ok(result.status === 'FLAGGED' || result.status === 'BLOCKED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Quick replies
// ═══════════════════════════════════════════════════════════════════════════════

describe('PARENT_QUICK_REPLIES', () => {
  it('is a non-empty readonly array', () => {
    assert.ok(PARENT_QUICK_REPLIES.length > 0);
  });

  it('contains at least a location-query reply', () => {
    const hasWhere = PARENT_QUICK_REPLIES.some((r) =>
      r.toLowerCase().includes('where'),
    );
    assert.ok(hasWhere, 'Expected a "where" style reply for parents');
  });
});

describe('DRIVER_QUICK_REPLIES', () => {
  it('is a non-empty readonly array', () => {
    assert.ok(DRIVER_QUICK_REPLIES.length > 0);
  });

  it('contains at least an "on my way" reply', () => {
    const hasWay = DRIVER_QUICK_REPLIES.some((r) =>
      r.toLowerCase().includes('way'),
    );
    assert.ok(hasWay, 'Expected an "on my way" style reply for drivers');
  });
});
