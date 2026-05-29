/**
 * Rating eligibility smoke tests — round-trip leg gate uses tripDirection semantics.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { areRoundTripLegsComplete } from '../lib/ratings/ratingEligibility.ts';

test('round-trip rating blocked until both legs complete', () => {
  assert.equal(
    areRoundTripLegsComplete([{ legType: 'OUTBOUND', status: 'COMPLETED' }]),
    false,
  );
  assert.equal(
    areRoundTripLegsComplete([
      { legType: 'OUTBOUND', status: 'COMPLETED' },
      { legType: 'RETURN', status: 'SCHEDULED' },
    ]),
    false,
  );
  assert.equal(
    areRoundTripLegsComplete([
      { legType: 'OUTBOUND', status: 'COMPLETED' },
      { legType: 'RETURN', status: 'COMPLETED' },
    ]),
    true,
  );
});

test('one-way trip does not use round-trip leg helper path', () => {
  assert.equal(
    areRoundTripLegsComplete([{ legType: 'OUTBOUND', status: 'COMPLETED' }]),
    false,
    'single completed outbound is not round-trip complete',
  );
});
