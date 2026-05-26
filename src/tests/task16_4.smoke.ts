/**
 * Task 16.4 — DB search, overlay, cache, confidence, diagnostics
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMapPlaceNormalizedFields } from '../lib/maps/mapPlaceNormalize.ts';
import {
  confidenceForExternal,
  confidenceForLocal,
  confidenceForManual,
  needsAdminReview,
} from '../lib/maps/confidence.ts';
import { mergeGeocodeResults } from '../lib/maps/mergeGeocodeResults.ts';
import { roundCoord, normalizeForwardQuery } from '../lib/maps/geocodeCacheUtils.ts';
import { getMapSearchProviderMode, resolveAutoSearchProviderOrder } from '../lib/maps/providers/resolve.ts';
import {
  MAP_OVERLAY_MIN_ZOOM,
  buildOverlayLabelIconHtml,
  toSelectedLocation,
} from '../lib/location/stableMapPickerHelpers.ts';
import type { GeocodeSearchResult } from '../lib/maps/geocodeTypes.ts';

const ROOT = join(import.meta.dirname, '..', '..');

describe('normalized Arabic search fields', () => {
  it('builds normalized name and alias columns', () => {
    const n = buildMapPlaceNormalizedFields({
      nameAr: 'جامعة الأمير مقرن',
      nameEn: 'University of Prince Mugrin',
      aliasesAr: ['مقرن'],
      aliasesEn: ['Mugrin'],
    });
    assert.match(n.normalizedNameAr, /جامعه/);
    assert.match(n.normalizedNameEn, /university of prince mugrin/);
    assert.match(n.normalizedAliasesAr, /مقرن/);
  });
});

describe('DB-level local place search', () => {
  it('uses prisma findMany with take limit instead of loading all rows', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'localPlaceSearch.ts'), 'utf8');
    assert.match(src, /take: limit/);
    assert.doesNotMatch(src, /findMany\([\s\S]*isActive: true[\s\S]*\)[\s\S]*\.filter\(\(p\) => placeMatchesQuery/);
    assert.match(src, /buildSearchWhere/);
    assert.match(src, /listMapPlacesPaginated/);
  });
});

describe('admin pagination params', () => {
  it('map-places API accepts page and limit', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'admin', 'map-places', 'route.ts'), 'utf8');
    assert.match(route, /listMapPlacesPaginated/);
    assert.match(route, /page/);
    assert.match(route, /limit/);
  });
});

describe('bbox local places overlay API', () => {
  it('places route filters verified active places in bounds', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'maps', 'places', 'route.ts'), 'utf8');
    assert.match(route, /listMapPlacesInBbox/);
    assert.match(route, /bbox/);
  });

  it('inner map shows overlay at zoom >= 14', () => {
    const inner = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapInnerMap.tsx'), 'utf8');
    assert.match(inner, /MAP_OVERLAY_MIN_ZOOM/);
    assert.match(inner, /\/api\/maps\/places/);
    assert.match(inner, /buildOverlayLabelIconHtml/);
    assert.equal(MAP_OVERLAY_MIN_ZOOM, 14);
    assert.match(buildOverlayLabelIconHtml('Test Place'), /Test Place/);
  });

  it('StableMapPicker uses lucide MapPlaceTypeIcon not emoji', () => {
    const picker = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapPicker.tsx'), 'utf8');
    assert.match(picker, /MapPlaceTypeIcon/);
    assert.doesNotMatch(picker, /mapPlaceTypeIcon/);
    assert.match(picker, /showVerifiedPlaces/);
    assert.match(picker, /confirmPinCarefully/);
  });
});

describe('confidence labels', () => {
  it('assigns HIGH/MEDIUM/LOW correctly', () => {
    assert.equal(confidenceForLocal(true), 'HIGH');
    assert.equal(confidenceForLocal(false), 'MEDIUM');
    assert.equal(confidenceForManual(), 'LOW');
    assert.equal(confidenceForExternal('NOMINATIM', {}), 'LOW');
    assert.equal(needsAdminReview('LOW', 'MANUAL'), true);
    assert.equal(needsAdminReview('HIGH', 'LOCAL', true), false);
  });

  it('geocode results include confidenceLevel', () => {
    const geo = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'geocoding.ts'), 'utf8');
    assert.match(geo, /confidenceLevel/);
    assert.match(geo, /needsAdminReview/);
  });
});

describe('location review workflow', () => {
  it('creates review items from subscription create', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'subscriptions', 'route.ts'), 'utf8');
    assert.match(route, /createLocationReviewIfNeeded/);
    const admin = readFileSync(join(ROOT, 'src', 'app', 'admin', 'sections', 'MapPlacesSection.tsx'), 'utf8');
    assert.match(admin, /Unverified locations from subscriptions/);
    assert.match(admin, /adminMapLocationReviewService/);
  });
});

describe('geocode cache', () => {
  it('rounds reverse coordinates to 5 decimals', () => {
    assert.equal(roundCoord(24.467234567), 24.46723);
  });

  it('geocoding uses forward/reverse cache helpers', () => {
    const geo = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'geocoding.ts'), 'utf8');
    assert.match(geo, /getForwardGeocodeCache/);
    assert.match(geo, /setReverseGeocodeCache/);
    assert.match(normalizeForwardQuery('  Riyadh  ', 'en'), /riyadh/);
  });
});

describe('provider AUTO selection', () => {
  it('resolves local-first AUTO order', () => {
    const order = resolveAutoSearchProviderOrder();
    assert.equal(order[0], 'local');
    assert.ok(order.includes('nominatim'));
    assert.equal(getMapSearchProviderMode(), 'AUTO');
  });

  it('provider types file documents future providers', () => {
    const types = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'providers', 'types.ts'), 'utf8');
    assert.match(types, /google/);
    assert.match(types, /mapbox/);
    assert.match(types, /maptiler/);
  });
});

describe('diagnostics', () => {
  it('admin diagnostics route exists', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'admin', 'maps', 'diagnostics', 'route.ts'), 'utf8');
    assert.match(route, /runMapDiagnostics/);
    const cfg = readFileSync(join(ROOT, 'src', 'app', 'admin', 'sections', 'SystemConfigSection.tsx'), 'utf8');
    assert.match(cfg, /Maps &amp; Location Diagnostics/);
  });
});

describe('quote and confirmed locations', () => {
  it('quote payload still uses label/lat/lng only', () => {
    const sel = toSelectedLocation({
      label: 'Test',
      lat: 24.4,
      lng: 39.6,
      confidence: 'LOW',
      isManual: true,
      source: 'MANUAL',
    });
    assert.equal(sel.label, 'Test');
    assert.equal(sel.latitude, 24.4);
    assert.equal(sel.longitude, 39.6);
  });

  it('merge keeps local before external', () => {
    const local: GeocodeSearchResult[] = [{
      label: 'Local',
      title: 'Local',
      subtitle: 'Medina',
      latitude: 24.46,
      longitude: 39.61,
      provider: 'local',
      source: 'LOCAL',
      providerBadge: 'Verified',
      confidenceLevel: 'HIGH',
    }];
    const external: GeocodeSearchResult[] = [{
      label: 'OSM',
      title: 'OSM',
      subtitle: 'Medina',
      latitude: 24.5,
      longitude: 39.62,
      provider: 'nominatim',
      source: 'NOMINATIM',
      providerBadge: 'OSM',
      confidenceLevel: 'LOW',
    }];
    const merged = mergeGeocodeResults(local, external, 8);
    assert.equal(merged[0]?.source, 'LOCAL');
  });
});

describe('nested button hydration fix', () => {
  it('mobile map place card does not nest buttons', () => {
    const admin = readFileSync(join(ROOT, 'src', 'app', 'admin', 'sections', 'MapPlacesSection.tsx'), 'utf8');
    const card = admin.match(/<AdminDataCard[\s\S]*?compact\s*\/>/)?.[0] ?? '';
    assert.ok(card.length > 0);
    const beforeActions = card.split('actions=')[0] ?? card;
    assert.doesNotMatch(beforeActions, /onClick=/);
  });
});
