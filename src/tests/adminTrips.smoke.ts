/**
 * Admin Trips UI helpers — smoke tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminTripListParams,
  countNeedsDispatchTrips,
  formatAssignConflictMessage,
  formatDispatchNoteSummary,
  formatGenerateTripsExplanation,
  formatGenerateTripsSummary,
  formatLegType,
  formatRouteSummary,
  getPrimaryTripAction,
  getTripCardBadges,
  shouldShowTechnicalJsonPrimary,
  truncateRouteLabel,
} from '../lib/ui/adminTrips.ts';
import { classifyTripForBoard } from '../lib/ui/adminOperations.ts';
import { normalizeAdminTripDetail } from '../lib/ui/adminTripDetail.ts';

describe('admin trips formatters', () => {
  it('formats generate trips summary with date range', () => {
    const summary = formatGenerateTripsSummary({
      startDate: '2026-05-24',
      endDate: '2026-06-07',
      generatedCount: 12,
      confirmedCount: 10,
      needsDispatchCount: 2,
      skippedCount: 4,
      failedCount: 0,
    });
    assert.match(summary, /2026-05-24–2026-06-07/);
    assert.match(summary, /12 created/);
    assert.match(summary, /10 confirmed/);
    assert.match(summary, /2 need dispatch/);
    assert.match(summary, /4 skipped/);
  });

  it('explains mixed confirm and needs-dispatch generation', () => {
    const text = formatGenerateTripsExplanation({ confirmedCount: 2, needsDispatchCount: 1, skippedCount: 0, generatedCount: 3 });
    assert.match(text, /auto-confirmed/i);
    assert.match(text, /manual dispatch/i);
  });

  it('truncates long route labels', () => {
    const long = 'A'.repeat(60);
    assert.equal(truncateRouteLabel(long, 42).length, 42);
    assert.match(truncateRouteLabel(long, 42), /…$/);
  });

  it('formats route summary with arrow', () => {
    assert.match(formatRouteSummary('School A', 'Home B'), /School A → Home B/);
  });

  it('summarizes dispatch notes', () => {
    assert.equal(formatDispatchNoteSummary('Short note'), 'Short note');
    assert.match(formatDispatchNoteSummary('X'.repeat(100), 40), /…$/);
  });

  it('formats assign conflict messages human-readably', () => {
    assert.match(
      formatAssignConflictMessage('Driver cannot reach next pickup in time (needs 15 extra min)'),
      /cannot reach/i,
    );
    assert.match(formatAssignConflictMessage(null), /schedule conflict/i);
  });

  it('labels leg types', () => {
    assert.equal(formatLegType('OUTBOUND'), 'Outbound');
    assert.equal(formatLegType('RETURN'), 'Return');
  });
});

describe('admin trips board helpers', () => {
  it('groups needsDispatch into attention column', () => {
    assert.equal(
      classifyTripForBoard({ status: 'SCHEDULED', driver: null, needsDispatch: true }),
      'attention',
    );
  });

  it('counts needs dispatch trips', () => {
    assert.equal(countNeedsDispatchTrips([
      { needsDispatch: true },
      { needsDispatch: false },
      { needsDispatch: true },
    ]), 2);
  });

  it('returns trip card badges for dispatch and unassigned', () => {
    const dispatchBadges = getTripCardBadges({ needsDispatch: true, status: 'SCHEDULED' });
    assert.ok(dispatchBadges.some((b) => b.key === 'needs-dispatch'));
    const unassigned = getTripCardBadges({ status: 'SCHEDULED', driver: null });
    assert.ok(unassigned.some((b) => b.key === 'unassigned'));
  });

  it('selects primary action assign vs reassign', () => {
    assert.equal(getPrimaryTripAction({ status: 'SCHEDULED', needsDispatch: true }), 'assign');
    assert.equal(getPrimaryTripAction({ status: 'DRIVER_ASSIGNED', driver: { id: '1' } }), 'reassign');
    assert.equal(getPrimaryTripAction({ status: 'ON_THE_WAY', driver: { id: '1' } }), 'track');
  });

  it('builds list filter params for needs dispatch preset', () => {
    assert.deepEqual(
      buildAdminTripListParams({ preset: 'needs_dispatch', date: '2026-05-24' }),
      { date: '2026-05-24', needsDispatch: 'true' },
    );
  });
});

describe('admin trip detail normalization', () => {
  it('does not use raw JSON as primary drawer view', () => {
    assert.equal(shouldShowTechnicalJsonPrimary(), false);
  });

  it('normalizes dispatch fields for drawer', () => {
    const normalized = normalizeAdminTripDetail({
      trip: {
        id: 't1',
        status: 'SCHEDULED',
        needsDispatch: true,
        dispatchNote: 'Timeline conflict',
        legType: 'OUTBOUND',
        scheduledDate: '2026-05-24',
        scheduledPickupTime: '2026-05-24T08:00:00.000Z',
        pickupLocation: 'A',
        dropoffLocation: 'B',
        subscription: {
          assignedDriver: { profile: { fullName: 'Default Driver' } },
          package: { name: 'Monthly' },
        },
      },
      chatSummary: { flagged: 1, total: 3 },
      location: { stale: true },
    });
    assert.equal(normalized.needsDispatch, true);
    assert.equal(normalized.dispatchNote, 'Timeline conflict');
    assert.equal(normalized.subscription?.defaultDriverName, 'Default Driver');
    assert.equal(normalized.chatFlaggedCount, 1);
    assert.equal(normalized.gpsStale, true);
  });
});
