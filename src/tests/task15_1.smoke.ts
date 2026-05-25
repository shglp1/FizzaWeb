/**
 * Task 15.1 smoke tests — loyalty redemption, R2 storage, vehicle photo, OSRM fallback.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLoyaltyRedemption,
  maxRedeemablePoints,
  pointsToSarDiscount,
  sarDiscountToPoints,
} from '../lib/loyalty/loyaltyRedemptionRules.ts';
import { validateCategoryUpload, getMaxUploadBytes, getStorageDriver, validateR2Config } from '../lib/storage/uploadValidation.ts';
import { listDriverApplicationDocuments, isImageUrl } from '../lib/driver/driverApplicationDocs.ts';
import { mapDistanceProviderLabel } from '../lib/ui/mapLocation.ts';
import { approximateRoadKm, haversineKm } from '../lib/maps/distance.ts';

const CONFIG = {
  enabled: true,
  pointsPerSar: 10,
  maxPercentOfOrder: 20,
  minimumPointsToRedeem: 100,
};

describe('pointsToSarDiscount', () => {
  it('converts points to SAR', () => {
    assert.equal(pointsToSarDiscount(100, 10), 10);
    assert.equal(pointsToSarDiscount(50, 10), 5);
  });
});

describe('calculateLoyaltyRedemption', () => {
  it('returns zero discount when disabled', () => {
    const r = calculateLoyaltyRedemption({
      subtotalSar: 1000,
      promoDiscountSar: 0,
      pointsToRedeem: 500,
      availablePoints: 500,
      config: { ...CONFIG, enabled: false },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /not available/i);
  });

  it('rejects insufficient points', () => {
    const r = calculateLoyaltyRedemption({
      subtotalSar: 1000,
      promoDiscountSar: 0,
      pointsToRedeem: 200,
      availablePoints: 50,
      config: CONFIG,
    });
    assert.equal(r.ok, false);
  });

  it('caps discount by max percent of order', () => {
    const r = calculateLoyaltyRedemption({
      subtotalSar: 1000,
      promoDiscountSar: 0,
      pointsToRedeem: 5000,
      availablePoints: 5000,
      config: CONFIG,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.discountSar, 200);
      assert.equal(r.finalPriceSar, 800);
    }
  });

  it('applies promo before loyalty', () => {
    const r = calculateLoyaltyRedemption({
      subtotalSar: 1000,
      promoDiscountSar: 100,
      pointsToRedeem: 1000,
      availablePoints: 1000,
      config: CONFIG,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.priceAfterPromoSar, 900);
      assert.equal(r.discountSar, 100);
      assert.equal(r.finalPriceSar, 800);
    }
  });

  it('final price cannot go below zero', () => {
    const r = calculateLoyaltyRedemption({
      subtotalSar: 50,
      promoDiscountSar: 40,
      pointsToRedeem: 200,
      availablePoints: 200,
      config: CONFIG,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.finalPriceSar, 0);
  });
});

describe('maxRedeemablePoints', () => {
  it('respects available balance and cap', () => {
    const pts = maxRedeemablePoints(1000, 900, 500, CONFIG);
    assert.equal(pts, 500);
  });
});

describe('storage validation', () => {
  it('local driver default', () => {
    const prev = process.env.STORAGE_DRIVER;
    process.env.STORAGE_DRIVER = 'local';
    assert.equal(getStorageDriver(), 'local');
    process.env.STORAGE_DRIVER = prev;
  });

  it('r2 env validation fails when missing', () => {
    const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    keys.forEach((k) => { delete process.env[k]; });
    process.env.STORAGE_DRIVER = 'r2';
    const r = validateR2Config();
    assert.equal(r.ok, false);
    keys.forEach((k) => {
      if (saved[k]) process.env[k] = saved[k];
    });
  });

  it('rejects unsupported MIME for vehicle photo category', () => {
    const r = validateCategoryUpload('driver-vehicle-photo', 'application/pdf', 1000);
    assert.equal(r.ok, false);
  });

  it('rejects oversized file', () => {
    const r = validateCategoryUpload('profile-avatar', 'image/jpeg', getMaxUploadBytes() + 1);
    assert.equal(r.ok, false);
  });
});

describe('driver application documents', () => {
  it('lists uploaded document URLs', () => {
    const docs = listDriverApplicationDocuments({
      nationalIdUrl: '/uploads/id.pdf',
      vehiclePhotoUrl: '/uploads/car.jpg',
    });
    assert.equal(docs.length, 2);
    assert.ok(docs.some((d) => d.key === 'vehiclePhotoUrl'));
  });

  it('detects image URLs', () => {
    assert.equal(isImageUrl('/x/photo.jpg'), true);
    assert.equal(isImageUrl('/x/doc.pdf'), false);
  });
});

describe('mapDistanceProviderLabel', () => {
  it('labels OSRM free provider', () => {
    assert.match(mapDistanceProviderLabel('OSRM_FREE'), /OSRM/i);
  });

  it('labels approximate haversine', () => {
    assert.match(mapDistanceProviderLabel('HAVERSINE_ESTIMATE', true), /Approximate/i);
  });
});

describe('haversine fallback distance', () => {
  it('uses configured road factor', () => {
    const prev = process.env.DISTANCE_FALLBACK_ROAD_FACTOR;
    process.env.DISTANCE_FALLBACK_ROAD_FACTOR = '1.35';
    const straight = haversineKm({ lat: 24.7136, lng: 46.6753 }, { lat: 24.75, lng: 46.72 });
    const road = approximateRoadKm({ lat: 24.7136, lng: 46.6753 }, { lat: 24.75, lng: 46.72 });
    assert.equal(road, Math.round(straight * 1.35 * 100) / 100);
    if (prev) process.env.DISTANCE_FALLBACK_ROAD_FACTOR = prev;
    else delete process.env.DISTANCE_FALLBACK_ROAD_FACTOR;
  });
});

describe('sarDiscountToPoints', () => {
  it('floors partial points', () => {
    assert.equal(sarDiscountToPoints(1.5, 10), 15);
  });
});
