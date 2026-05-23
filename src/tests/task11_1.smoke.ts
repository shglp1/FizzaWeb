/**
 * Task 11.1 smoke tests — run with: npm test
 * Tests for: Google Maps link helpers, trip grouping logic, driver assignment helpers.
 * No database or browser required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsDirectionsFromCoords,
  buildGoogleMapsPlaceUrl,
  tripToGoogleMapsUrl,
} from '../lib/maps/googleMapsLink.ts';

// ─── buildGoogleMapsDirectionsUrl ─────────────────────────────────────────────

describe('buildGoogleMapsDirectionsUrl', () => {
  it('returns a valid Google Maps directions URL', () => {
    const url = buildGoogleMapsDirectionsUrl('Riyadh Airport', 'King Fahd District');
    assert.ok(url.startsWith('https://www.google.com/maps/dir/?'), `Expected directions URL, got: ${url}`);
    assert.ok(url.includes('travelmode=driving'));
    assert.ok(url.includes('origin='));
    assert.ok(url.includes('destination='));
  });

  it('encodes spaces in addresses', () => {
    const url = buildGoogleMapsDirectionsUrl('Al Nakheel District', 'King Faisal School');
    assert.ok(url.includes('Al+Nakheel') || url.includes('Al%20Nakheel'), 'space should be encoded');
  });
});

// ─── buildGoogleMapsDirectionsFromCoords ──────────────────────────────────────

describe('buildGoogleMapsDirectionsFromCoords', () => {
  it('produces a URL with lat/lng as origin and destination', () => {
    const url = buildGoogleMapsDirectionsFromCoords(
      { lat: 24.6877, lng: 46.7219 },
      { lat: 24.7200, lng: 46.8000 },
    );
    assert.ok(url.includes('24.6877'));
    assert.ok(url.includes('46.7219'));
    assert.ok(url.includes('24.72'));
    assert.ok(url.includes('46.8'));
  });

  it('uses driving travel mode', () => {
    const url = buildGoogleMapsDirectionsFromCoords(
      { lat: 24.0, lng: 46.0 },
      { lat: 25.0, lng: 47.0 },
    );
    assert.ok(url.includes('travelmode=driving'));
  });
});

// ─── buildGoogleMapsPlaceUrl ──────────────────────────────────────────────────

describe('buildGoogleMapsPlaceUrl', () => {
  it('returns a search URL with the coordinates', () => {
    const url = buildGoogleMapsPlaceUrl(24.6877, 46.7219);
    assert.ok(url.startsWith('https://www.google.com/maps/search/'));
    assert.ok(url.includes('24.6877'));
    assert.ok(url.includes('46.7219'));
  });

  it('uses label as query when provided', () => {
    const url = buildGoogleMapsPlaceUrl(24.6877, 46.7219, 'Al-Nakheel District');
    assert.ok(url.includes('Al-Nakheel'));
  });

  it('falls back to coordinate string as query when no label', () => {
    const url = buildGoogleMapsPlaceUrl(24.0, 46.0);
    assert.ok(url.includes('24') && url.includes('46'));
  });
});

// ─── tripToGoogleMapsUrl ──────────────────────────────────────────────────────

describe('tripToGoogleMapsUrl', () => {
  it('uses coordinates when all four are present', () => {
    const url = tripToGoogleMapsUrl({
      pickupLocation: 'Pickup',
      dropoffLocation: 'Dropoff',
      pickupLat: 24.6877,
      pickupLng: 46.7219,
      dropoffLat: 24.7200,
      dropoffLng: 46.8000,
    });
    assert.ok(url.includes('24.6877'), 'should include pickupLat');
    assert.ok(url.includes('46.7219'), 'should include pickupLng');
    assert.ok(url.includes('24.72'), 'should include dropoffLat');
  });

  it('falls back to address strings when coordinates are null', () => {
    const url = tripToGoogleMapsUrl({
      pickupLocation: 'Al-Nakheel District, Riyadh',
      dropoffLocation: 'King Faisal School, Riyadh',
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
    });
    assert.ok(url.includes('Al-Nakheel') || url.includes('Al%2DNakheel'), 'should include pickup address');
    assert.ok(url.includes('King+Faisal') || url.includes('King%20Faisal') || url.includes('King+Faisal'), 'should include dropoff address');
  });

  it('falls back when only some coordinates are null', () => {
    const url = tripToGoogleMapsUrl({
      pickupLocation: 'Pickup Addr',
      dropoffLocation: 'Dropoff Addr',
      pickupLat: 24.0,
      pickupLng: null,   // partial — should fall back
      dropoffLat: 25.0,
      dropoffLng: 47.0,
    });
    // Falls back to address directions since not all coords present
    assert.ok(url.includes('Pickup') || url.includes('Dropoff'));
    assert.ok(!url.includes('24.0,null'), 'should not embed null as string');
  });

  it('works without optional coordinate fields at all', () => {
    const url = tripToGoogleMapsUrl({
      pickupLocation: 'Origin',
      dropoffLocation: 'Dest',
    });
    assert.ok(url.startsWith('https://www.google.com/maps/dir/'));
    assert.ok(url.includes('Origin') || url.includes('origin='));
  });
});

// ─── Trip grouping logic ───────────────────────────────────────────────────────

describe('groupTripsByDate (inline logic)', () => {
  type MinTrip = { id: string; scheduledDate: string; subscription: { id: string } | null; driver: unknown | null };

  function groupByDate(trips: MinTrip[]): Map<string, MinTrip[]> {
    const map = new Map<string, MinTrip[]>();
    for (const t of trips) {
      const key = t.scheduledDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }

  const trips: MinTrip[] = [
    { id: '1', scheduledDate: '2026-06-01T00:00:00Z', subscription: { id: 'sub-a' }, driver: { id: 'drv-1' } },
    { id: '2', scheduledDate: '2026-06-01T00:00:00Z', subscription: { id: 'sub-a' }, driver: null },
    { id: '3', scheduledDate: '2026-06-02T00:00:00Z', subscription: { id: 'sub-b' }, driver: { id: 'drv-2' } },
    { id: '4', scheduledDate: '2026-06-02T00:00:00Z', subscription: { id: 'sub-b' }, driver: null },
    { id: '5', scheduledDate: '2026-06-02T00:00:00Z', subscription: null, driver: null },
  ];

  it('groups trips into 2 date buckets', () => {
    const grouped = groupByDate(trips);
    assert.equal(grouped.size, 2);
    assert.equal(grouped.get('2026-06-01')?.length, 2);
    assert.equal(grouped.get('2026-06-02')?.length, 3);
  });

  it('counts assigned vs unassigned correctly per date', () => {
    const grouped = groupByDate(trips);
    const june1 = grouped.get('2026-06-01')!;
    const assigned1 = june1.filter((t) => t.driver != null).length;
    const unassigned1 = june1.length - assigned1;
    assert.equal(assigned1, 1);
    assert.equal(unassigned1, 1);

    const june2 = grouped.get('2026-06-02')!;
    const assigned2 = june2.filter((t) => t.driver != null).length;
    const unassigned2 = june2.length - assigned2;
    assert.equal(assigned2, 1);
    assert.equal(unassigned2, 2);
  });

  it('handles all trips on same date', () => {
    const same = trips.slice(0, 2);
    const grouped = groupByDate(same);
    assert.equal(grouped.size, 1);
    assert.equal(grouped.get('2026-06-01')?.length, 2);
  });

  it('handles empty list', () => {
    const grouped = groupByDate([]);
    assert.equal(grouped.size, 0);
  });
});

describe('groupBySubscription (inline logic)', () => {
  type MinTrip = { id: string; subscription: { id: string } | null };

  function groupBySub(trips: MinTrip[]): Map<string, MinTrip[]> {
    const map = new Map<string, MinTrip[]>();
    for (const t of trips) {
      const key = t.subscription?.id ?? 'none';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }

  it('groups trips by subscription id', () => {
    const trips: MinTrip[] = [
      { id: '1', subscription: { id: 'sub-a' } },
      { id: '2', subscription: { id: 'sub-a' } },
      { id: '3', subscription: { id: 'sub-b' } },
    ];
    const grouped = groupBySub(trips);
    assert.equal(grouped.size, 2);
    assert.equal(grouped.get('sub-a')?.length, 2);
    assert.equal(grouped.get('sub-b')?.length, 1);
  });

  it('uses "none" key for trips without subscription', () => {
    const trips: MinTrip[] = [
      { id: '1', subscription: null },
      { id: '2', subscription: null },
    ];
    const grouped = groupBySub(trips);
    assert.equal(grouped.size, 1);
    assert.ok(grouped.has('none'));
    assert.equal(grouped.get('none')?.length, 2);
  });

  it('handles mix of subscribed and unsubscribed', () => {
    const trips: MinTrip[] = [
      { id: '1', subscription: { id: 'sub-a' } },
      { id: '2', subscription: null },
    ];
    const grouped = groupBySub(trips);
    assert.equal(grouped.size, 2);
    assert.ok(grouped.has('sub-a'));
    assert.ok(grouped.has('none'));
  });
});
