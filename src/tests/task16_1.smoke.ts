/**
 * Task 16.1 — CSP OSM tiles, quote payload, admin promo codes smoke tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSubscriptionQuotePayload,
  mapQuoteValidationError,
  normalizeQuoteLocation,
} from '../lib/subscriptions/quotePayload.ts';
import { subscriptionQuoteSchema } from '../lib/validations/subscription.ts';
import {
  ADMIN_SECTIONS,
  ADMIN_SECTION_LABELS,
  adminSectionHref,
  parseAdminSection,
} from '../lib/adminNav.ts';
import {
  averageOrderAfterDiscount,
  computePromoKpis,
  decodePromoNotes,
  encodePromoNotes,
  filterPromoCodes,
  getPromoCodeStatus,
  normalizePromoCodeInput,
  remainingPromoUses,
  sortPromoCodes,
  validatePromoForm,
} from '../lib/promo/promoAdminHelpers.ts';
import { toSelectedLocation } from '../lib/location/stableMapPickerHelpers.ts';

const ROOT = join(import.meta.dirname, '..', '..');

describe('CSP — OSM tile domains', () => {
  it('allows OpenStreetMap tile hosts without img-src *', () => {
    const config = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
    assert.match(config, /tile\.openstreetmap\.org/);
    assert.match(config, /\*\.tile\.openstreetmap\.org/);
    assert.doesNotMatch(config, /img-src \*/);
  });
});

describe('quote payload builder', () => {
  const pickup = { label: 'Home district', lat: 24.7136, lng: 46.6753 };
  const dropoff = { label: 'School gate', lat: 24.75, lng: 46.72 };

  it('maps StableMapPicker lat/lng to latitude/longitude', () => {
    const built = buildSubscriptionQuotePayload({
      packageId: null,
      addOnIds: [],
      pickupLocation: pickup,
      dropoffLocation: dropoff,
      tripDirection: 'ROUND_TRIP',
      riderIds: ['00000000-0000-4000-8000-000000000001'],
      weekdays: [1, 2, 3, 4, 5],
      startsOn: '',
      promoCode: '',
      loyaltyPointsToRedeem: 0,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.payload.pickupLocation.latitude, pickup.lat);
    assert.equal(built.payload.pickupLocation.longitude, pickup.lng);
    assert.equal(built.payload.dropoffLocation.label, dropoff.label);
  });

  it('passes subscriptionQuoteSchema validation', () => {
    const built = buildSubscriptionQuotePayload({
      packageId: null,
      addOnIds: [],
      pickupLocation: toSelectedLocation(pickup),
      dropoffLocation: toSelectedLocation(dropoff),
      tripDirection: 'ONE_WAY',
      riderIds: ['00000000-0000-4000-8000-000000000002'],
      weekdays: [1, 2, 3],
      startsOn: '2026-06-01',
      promoCode: 'TEST10',
      loyaltyPointsToRedeem: 0,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const parsed = subscriptionQuoteSchema.safeParse(built.payload);
    assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
  });

  it('returns friendly message when locations missing', () => {
    const built = buildSubscriptionQuotePayload({
      packageId: null,
      addOnIds: [],
      pickupLocation: { label: 'Hi', lat: 24, lng: 46 },
      dropoffLocation: dropoff,
      tripDirection: 'ROUND_TRIP',
      riderIds: ['00000000-0000-4000-8000-000000000003'],
      weekdays: [1],
      startsOn: '',
      promoCode: '',
      loyaltyPointsToRedeem: 0,
    });
    assert.equal(built.ok, false);
    if (built.ok) return;
    assert.match(built.message, /confirm both pickup and drop-off/i);
  });

  it('accepts lat/lng alias in schema preprocess', () => {
    const parsed = subscriptionQuoteSchema.safeParse({
      packageId: undefined,
      addOnIds: [],
      pickupLocation: { label: 'Pickup spot', lat: 24.1, lng: 46.1 },
      dropoffLocation: { label: 'Dropoff spot', lat: 24.2, lng: 46.2 },
      tripDirection: 'ROUND_TRIP',
      riderIds: ['00000000-0000-4000-8000-000000000004'],
    });
    assert.equal(parsed.success, true);
  });
});

describe('mapQuoteValidationError', () => {
  it('maps location validation to parent-friendly copy', () => {
    const msg = mapQuoteValidationError('Latitude is required', [
      { code: 'custom', path: ['pickupLocation', 'latitude'], message: 'Latitude is required' },
    ]);
    assert.match(msg, /confirm both pickup and drop-off/i);
  });

  it('maps rider errors clearly', () => {
    const msg = mapQuoteValidationError('At least one rider is required');
    assert.match(msg, /select at least one rider/i);
  });
});

describe('normalizeQuoteLocation', () => {
  it('rejects invalid coordinates', () => {
    assert.equal(normalizeQuoteLocation({ label: 'Test loc', lat: NaN, lng: 46 }), null);
  });
});

describe('admin promo codes nav', () => {
  it('includes promo-codes section in sidebar config', () => {
    assert.ok(ADMIN_SECTIONS.some((s) => s.section === 'promo-codes'));
    assert.equal(ADMIN_SECTION_LABELS['promo-codes'], 'Promo Codes');
    assert.equal(adminSectionHref('promo-codes'), '/admin?section=promo-codes');
    assert.equal(parseAdminSection('promo-codes'), 'promo-codes');
  });

  it('PromoCodesSection route is wired in admin page', () => {
    const page = readFileSync(join(ROOT, 'src', 'app', 'admin', 'page.tsx'), 'utf8');
    assert.match(page, /PromoCodesSection/);
    assert.match(page, /promo-codes/);
  });

  it('Packages section links to dedicated promo page', () => {
    const pkgs = readFileSync(join(ROOT, 'src', 'app', 'admin', 'sections', 'PackagesSection.tsx'), 'utf8');
    assert.doesNotMatch(pkgs, /PromoCodesPanel/);
    assert.match(pkgs, /promo-codes/);
  });
});

describe('promo admin helpers', () => {
  const base = {
    id: '1',
    code: 'TEST10',
    partnerName: 'Influencer',
    discountPercent: 10,
    maxUses: 5,
    useCount: 2,
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    isActive: true,
    totalDiscountSar: 100,
    totalPaidSar: 900,
    notes: null,
    createdAt: new Date().toISOString(),
  };

  it('computes status active/expired/disabled', () => {
    assert.equal(getPromoCodeStatus(base), 'active');
    assert.equal(getPromoCodeStatus({ ...base, isActive: false }), 'disabled');
    assert.equal(
      getPromoCodeStatus({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() }),
      'expired',
    );
    assert.equal(getPromoCodeStatus({ ...base, useCount: 5 }), 'exhausted');
  });

  it('calculates remaining uses and averages', () => {
    assert.equal(remainingPromoUses(base), 3);
    assert.equal(averageOrderAfterDiscount(base), 450);
  });

  it('validates create/edit form', () => {
    assert.equal(
      validatePromoForm(
        {
          code: 'ab',
          discountPercent: '10',
          partnerName: '',
          campaignName: '',
          maxUses: '',
          expiresAt: '',
          isActive: true,
          notes: '',
        },
        [],
      ),
      'Code must be at least 3 characters',
    );
    assert.equal(normalizePromoCodeInput(' test10 '), 'TEST10');
  });

  it('filters, sorts, and aggregates KPIs', () => {
    const codes = [base, { ...base, id: '2', code: 'VIP20', useCount: 10, totalPaidSar: 2000 }];
    const filtered = filterPromoCodes(codes, 'vip', 'all');
    assert.equal(filtered.length, 1);
    const sorted = sortPromoCodes(codes, 'most_used');
    assert.equal(sorted[0]?.code, 'VIP20');
    const kpis = computePromoKpis(codes);
    assert.equal(kpis.totalRedemptions, 12);
  });

  it('encodes and decodes campaign in notes', () => {
    const notes = encodePromoNotes('Spring launch', 'Partner note');
    assert.match(notes ?? '', /Campaign: Spring launch/);
    const decoded = decodePromoNotes(notes);
    assert.equal(decoded.campaignName, 'Spring launch');
    assert.equal(decoded.notes, 'Partner note');
  });
});

describe('StableMapPicker — no marker-icon.png', () => {
  it('still avoids default Leaflet PNG markers', () => {
    const inner = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapInnerMap.tsx'), 'utf8');
    assert.doesNotMatch(inner, /marker-icon\.png/);
  });

  it('shows OpenStreetMap attribution', () => {
    const picker = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapPicker.tsx'), 'utf8');
    assert.match(picker, /OpenStreetMap/);
  });
});

describe('subscription wizard headings', () => {
  it('uses quote payload helper in subscriptions/new', () => {
    const page = readFileSync(join(ROOT, 'src', 'app', 'subscriptions', 'new', 'page.tsx'), 'utf8');
    assert.match(page, /buildSubscriptionQuotePayload/);
    assert.match(page, /mapQuoteValidationError/);
  });
});
