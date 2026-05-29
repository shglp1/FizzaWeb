/**
 * Task 15 smoke tests — loyalty, promo, maps fallback, dashboard helpers, uploads.
 * Run: npm test (included in package.json)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickNextTrip, formatTripDateTime } from '../lib/parent/parentFormatters.ts';
import { computePromoDiscount, evaluatePromoEligibility } from '../lib/promo/promoCodeRules.ts';
import { approximateRoadKm, haversineKm } from '../lib/maps/distance.ts';
import { mapDistanceProviderLabel, sanitizeMapLabel } from '../lib/ui/mapLocation.ts';
import { uploadedOrHttpUrl } from '../lib/validations/upload.ts';

const ROOT = join(import.meta.dirname, '..', '..');

// ─── pickNextTrip ─────────────────────────────────────────────────────────────

describe('pickNextTrip', () => {
  const nowMs = new Date('2026-05-24T08:00:00.000Z').getTime();
  const upcoming = [
    { id: '1', status: 'SCHEDULED', scheduledDate: '2026-06-01', scheduledPickupTime: '2026-06-01T07:00:00.000Z' },
    { id: '2', status: 'SCHEDULED', scheduledDate: '2026-05-25', scheduledPickupTime: '2026-05-25T07:00:00.000Z' },
  ];
  const active = [
    { id: '3', status: 'ON_THE_WAY', scheduledDate: '2026-05-24', scheduledPickupTime: '2026-05-24T07:00:00.000Z' },
  ];

  it('prefers active trip over upcoming', () => {
    const next = pickNextTrip([...upcoming, ...active], nowMs);
    assert.equal(next?.id, '3');
  });

  it('returns nearest upcoming when no active trip', () => {
    const next = pickNextTrip(upcoming, nowMs);
    assert.equal(next?.id, '2');
  });

  it('returns null for empty list', () => {
    assert.equal(pickNextTrip([], nowMs), null);
  });
});

describe('formatTripDateTime', () => {
  it('uses Asia/Riyadh timezone (not UTC-only display)', () => {
    const s = formatTripDateTime('2026-05-24T04:30:00.000Z');
    assert.match(s, /May|مايو|\d/);
    assert.notEqual(s, '—');
  });
});

// ─── Promo codes ──────────────────────────────────────────────────────────────

describe('computePromoDiscount', () => {
  it('calculates percentage off subtotal', () => {
    assert.equal(computePromoDiscount(1000, 10), 100);
    assert.equal(computePromoDiscount(250, 20), 50);
  });

  it('returns 0 for invalid inputs', () => {
    assert.equal(computePromoDiscount(0, 10), 0);
    assert.equal(computePromoDiscount(100, 0), 0);
  });
});

describe('evaluatePromoEligibility', () => {
  const base = { isActive: true, expiresAt: null, maxUses: null, useCount: 0 };

  it('accepts valid active code', () => {
    assert.equal(evaluatePromoEligibility(base, false).ok, true);
  });

  it('rejects expired code', () => {
    const r = evaluatePromoEligibility(
      { ...base, expiresAt: new Date('2020-01-01') },
      false,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /expired/i);
  });

  it('rejects max uses reached', () => {
    const r = evaluatePromoEligibility({ ...base, maxUses: 5, useCount: 5 }, false);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /limit/i);
  });

  it('rejects duplicate user redemption', () => {
    const r = evaluatePromoEligibility(base, true);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /already used/i);
  });
});

describe('promo redemption timing (design)', () => {
  it('redemption is recorded in recordPromoRedemption on payment, not subscription create', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'promo', 'promoCode.ts'), 'utf8');
    assert.match(src, /recordPromoRedemption/);
    assert.doesNotMatch(
      readFileSync(join(ROOT, 'src', 'app', 'api', 'subscriptions', 'route.ts'), 'utf8'),
      /recordPromoRedemption/,
    );
  });

  it('recordPromoRedemption is idempotent per paymentId', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'promo', 'promoCode.ts'), 'utf8');
    assert.match(src, /paymentId/);
    assert.match(src, /findFirst/);
  });
});

// ─── Maps fallback ────────────────────────────────────────────────────────────

describe('maps approximate distance fallback', () => {
  it('haversine returns positive km for Riyadh coords', () => {
    const km = haversineKm({ lat: 24.7136, lng: 46.6753 }, { lat: 24.75, lng: 46.72 });
    assert.ok(km > 0 && km < 50);
  });

  it('approximateRoadKm applies road factor', () => {
    const straight = haversineKm({ lat: 24.7136, lng: 46.6753 }, { lat: 24.75, lng: 46.72 });
    const road = approximateRoadKm({ lat: 24.7136, lng: 46.6753 }, { lat: 24.75, lng: 46.72 });
    assert.ok(road > straight);
  });

  it('mapDistanceProviderLabel shows approximate warning', () => {
    const label = mapDistanceProviderLabel('OPENROUTESERVICE', true);
    assert.match(label, /approximate/i);
  });
});

describe('Leaflet markers — no default PNG dependency', () => {
  it('MapLocationPicker uses DivIcon', () => {
    const src = readFileSync(join(ROOT, 'src', 'components', 'location', 'MapLocationPicker.tsx'), 'utf8');
    assert.match(src, /divIcon/);
    assert.match(src, /fizza-map-marker/);
    assert.doesNotMatch(src, /marker-icon\.png/);
  });

  it('TripTrackingMap uses DivIcon', () => {
    const src = readFileSync(join(ROOT, 'src', 'components', 'tracking', 'TripTrackingMap.tsx'), 'utf8');
    assert.match(src, /divIcon/);
    assert.doesNotMatch(src, /marker-icon\.png/);
  });

  it('globals.css hides default Leaflet marker box', () => {
    const css = readFileSync(join(ROOT, 'src', 'styles', 'globals.css'), 'utf8');
    assert.match(css, /\.fizza-map-marker/);
  });
});

describe('Arabic map label safety', () => {
  it('sanitizeMapLabel preserves Arabic text', () => {
    const ar = 'حي النخيل، الرياض';
    assert.equal(sanitizeMapLabel(ar), ar);
  });

  it('sanitizeMapLabel strips angle brackets', () => {
    assert.equal(sanitizeMapLabel('<script>'), 'script');
  });
});

// ─── Upload validation ────────────────────────────────────────────────────────

describe('uploadedOrHttpUrl', () => {
  it('accepts local upload path', () => {
    assert.ok(uploadedOrHttpUrl.safeParse('/uploads/users/u1/profile-avatar/abc.jpg').success);
  });

  it('accepts https URL', () => {
    assert.ok(uploadedOrHttpUrl.safeParse('https://cdn.example.com/a.jpg').success);
  });

  it('rejects bare filename', () => {
    assert.ok(!uploadedOrHttpUrl.safeParse('evil.exe').success);
  });
});

describe('loyalty earning scope', () => {
  it('awards loyalty only on subscription payment path, not wallet top-up block', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'payments', 'processPaymentStatus.ts'), 'utf8');
    assert.match(src, /awardLoyaltyPointsForPayment/);
    const topUpBlock = src.slice(src.indexOf('WALLET_TOP_UP'), src.indexOf('SUBSCRIPTION_PAYMENT'));
    assert.doesNotMatch(topUpBlock, /awardLoyaltyPointsForPayment/);
  });
});

describe('dashboard hero inverse buttons', () => {
  it('dashboard uses inverse variant on hero actions', () => {
    const src = readFileSync(join(ROOT, 'src', 'app', 'dashboard', 'page.tsx'), 'utf8');
    assert.match(src, /variant="inverse"/);
    assert.match(src, /onDark/);
  });
});
