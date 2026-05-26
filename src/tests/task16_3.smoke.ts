/**
 * Task 16.3 — Local Saudi Places Registry, local-first geocode, picker UX
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeArabic,
  normalizeEnglish,
  textMatchesQuery,
} from '../lib/maps/arabicNormalize.ts';
import { mergeGeocodeResults } from '../lib/maps/mergeGeocodeResults.ts';
import { MAP_PLACE_DEDUPE_METERS, getLocalPlaceSnapRadiusMeters } from '../lib/maps/mapPlaceConfig.ts';
import type { GeocodeSearchResult } from '../lib/maps/geocodeTypes.ts';
import {
  DEFAULT_MAP_ZOOM_PLACE,
  DEFAULT_MAP_ZOOM_VERIFIED,
  isLocalGeocodeSuggestion,
  isVerifiedGeocodeSuggestion,
  mapPlaceTypeIcon,
  providerBadgeLabel,
  suggestionProviderBadge,
  toSelectedLocation,
} from '../lib/location/stableMapPickerHelpers.ts';
import { haversineDistanceMeters } from '../lib/location/locationDistance.ts';
import { mapPlaceCreateSchema } from '../lib/validations/mapPlace.ts';

const ROOT = join(import.meta.dirname, '..', '..');

const UPM_LAT = 24.4627;
const UPM_LNG = 39.6117;

function localResult(overrides: Partial<GeocodeSearchResult> = {}): GeocodeSearchResult {
  return {
    label: 'University of Prince Mugrin',
    title: 'University of Prince Mugrin',
    subtitle: 'Medina · Saudi Arabia',
    latitude: UPM_LAT,
    longitude: UPM_LNG,
    provider: 'local',
    source: 'LOCAL',
    providerBadge: 'Verified',
    placeId: 'seed-upm',
    type: 'UNIVERSITY',
    city: 'Medina',
    isVerified: true,
    ...overrides,
  };
}

describe('Arabic normalization', () => {
  it('removes tatweel and normalizes alef variants', () => {
    assert.equal(normalizeArabic('جـامعة'), normalizeArabic('جامعة'));
    assert.equal(normalizeArabic('أحمد'), normalizeArabic('احمد'));
    assert.equal(normalizeArabic('إبراهيم'), normalizeArabic('ابراهيم'));
  });

  it('matches partial Arabic queries', () => {
    assert.equal(textMatchesQuery('جامعة الأمير مقرن', 'مقرن', 'ar'), true);
    assert.equal(textMatchesQuery('جامعة الأمير مقرن', 'جامعة الأمير', 'ar'), true);
  });

  it('matches partial English queries case-insensitively', () => {
    assert.equal(textMatchesQuery('University of Prince Mugrin', 'mugrin', 'en'), true);
    assert.equal(textMatchesQuery('Prophet Mosque', 'prophet', 'en'), true);
    assert.equal(normalizeEnglish('  Al  Aziziyah '), 'al aziziyah');
  });
});

describe('local-first geocode merge', () => {
  it('keeps local results before external', () => {
    const local = [localResult()];
    const external: GeocodeSearchResult[] = [
      {
        label: 'Some OSM label',
        title: 'Some OSM label',
        subtitle: 'Medina',
        latitude: UPM_LAT + 0.01,
        longitude: UPM_LNG + 0.01,
        provider: 'nominatim',
        source: 'NOMINATIM',
        providerBadge: 'OSM',
      },
    ];
    const merged = mergeGeocodeResults(local, external, 8);
    assert.equal(merged[0]?.source, 'LOCAL');
    assert.equal(merged.length, 2);
  });

  it('dedupes external hits close to local coordinates', () => {
    const local = [localResult()];
    const external: GeocodeSearchResult[] = [
      {
        label: 'Duplicate nearby',
        title: 'Duplicate nearby',
        subtitle: 'Medina',
        latitude: UPM_LAT + 0.0001,
        longitude: UPM_LNG + 0.0001,
        provider: 'nominatim',
        source: 'NOMINATIM',
        providerBadge: 'OSM',
      },
    ];
    const dist = haversineDistanceMeters(
      local[0]!.latitude,
      local[0]!.longitude,
      external[0]!.latitude,
      external[0]!.longitude,
    );
    assert.ok(dist < MAP_PLACE_DEDUPE_METERS);
    const merged = mergeGeocodeResults(local, external, 8);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.source, 'LOCAL');
  });
});

describe('nearest local place by radius', () => {
  it('detects point within default snap radius of seed university', () => {
    const radius = getLocalPlaceSnapRadiusMeters();
    assert.ok(radius >= 150 && radius <= 300);
    const nearLat = UPM_LAT + 0.0005;
    const nearLng = UPM_LNG + 0.0005;
    const dist = haversineDistanceMeters(UPM_LAT, UPM_LNG, nearLat, nearLng);
    assert.ok(dist <= radius);
  });
});

describe('StableMapPicker badges and zoom', () => {
  it('labels verified/local/OSM/ORS badges', () => {
    assert.equal(suggestionProviderBadge(localResult()), 'Verified');
    assert.equal(providerBadgeLabel('local'), 'Local');
    assert.equal(providerBadgeLabel('nominatim'), 'OSM');
    assert.equal(providerBadgeLabel('openrouteservice'), 'ORS');
    assert.equal(
      suggestionProviderBadge({
        label: 'x',
        latitude: 0,
        longitude: 0,
        provider: 'nominatim',
        providerBadge: 'OSM',
      }),
      'OSM',
    );
  });

  it('uses zoom 17 for verified/local and 16 for external', () => {
    assert.equal(DEFAULT_MAP_ZOOM_VERIFIED, 17);
    assert.equal(DEFAULT_MAP_ZOOM_PLACE, 16);
    assert.equal(isVerifiedGeocodeSuggestion(localResult()), true);
    assert.equal(isLocalGeocodeSuggestion(localResult()), true);
    assert.equal(mapPlaceTypeIcon('UNIVERSITY'), '🎓');
  });

  it('removes duplicate search helper text', () => {
    const picker = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapPicker.tsx'), 'utf8');
    assert.doesNotMatch(picker, /searchHelper/);
    assert.match(picker, /copy\.searchHint/);
    assert.match(picker, /noMatchingPlace/);
    assert.match(picker, /suggestionProviderBadge/);
    assert.match(picker, /DEFAULT_MAP_ZOOM_VERIFIED/);
  });
});

describe('confirmed location and quote shape', () => {
  it('toSelectedLocation preserves label and coordinates', () => {
    const sel = toSelectedLocation({
      label: 'Prophet Mosque',
      lat: 24.4672,
      lng: 39.6111,
      placeId: 'seed-mosque',
      isVerifiedPlace: true,
      source: 'LOCAL',
    });
    assert.equal(sel.label, 'Prophet Mosque');
    assert.equal(sel.latitude, 24.4672);
    assert.equal(sel.longitude, 39.6111);
    assert.equal(sel.provider, 'LOCAL');
  });

  it('quote payload builder still expects label/lat/lng', () => {
    const quote = readFileSync(join(ROOT, 'src', 'lib', 'subscriptions', 'quotePayload.ts'), 'utf8');
    assert.match(quote, /label/);
    assert.match(quote, /latitude|lat/);
    assert.match(quote, /longitude|lng/);
  });
});

describe('geocode API local-first', () => {
  it('accepts 2-char queries and returns array on empty', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'maps', 'geocode', 'route.ts'), 'utf8');
    assert.match(route, /min\(2/);
    assert.match(route, /data: \[\]/);
  });

  it('searchLocations queries local registry first', () => {
    const geo = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'geocoding.ts'), 'utf8');
    assert.match(geo, /searchLocalMapPlaces/);
    assert.match(geo, /mergeGeocodeResults/);
    assert.match(geo, /findNearestLocalMapPlace/);
  });
});

describe('admin Map Places', () => {
  it('nav includes map-places section', () => {
    const nav = readFileSync(join(ROOT, 'src', 'lib', 'adminNav.ts'), 'utf8');
    assert.match(nav, /map-places/);
    assert.match(nav, /Map Places/);
  });

  it('admin section and API exist', () => {
    const admin = readFileSync(join(ROOT, 'src', 'app', 'admin', 'page.tsx'), 'utf8');
    assert.match(admin, /MapPlacesSection/);
    assert.match(admin, /map-places/);
    const api = readFileSync(join(ROOT, 'src', 'app', 'api', 'admin', 'map-places', 'route.ts'), 'utf8');
    assert.match(api, /mapPlaceCreateSchema/);
  });

  it('validates create payload', () => {
    const parsed = mapPlaceCreateSchema.safeParse({
      nameAr: 'المسجد النبوي',
      nameEn: 'Prophet Mosque',
      type: 'MOSQUE',
      city: 'Medina',
      latitude: 24.4672,
      longitude: 39.6111,
      aliasesEn: 'Prophet, Nabawi',
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.data.aliasesEn, ['Prophet', 'Nabawi']);
    }
  });
});

describe('seed and schema', () => {
  it('seed includes sample Saudi places', () => {
    const seed = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf8');
    assert.match(seed, /seedMapPlaces/);
    assert.match(seed, /جامعة الأمير مقرن/);
    assert.match(seed, /Prophet Mosque/);
    assert.match(seed, /Al Aziziyah/);
    assert.match(seed, /King Fahad Road/);
    assert.match(seed, /Emaar Taibah/);
  });

  it('MapPlace model exists in schema', () => {
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
    assert.match(schema, /model MapPlace/);
    assert.match(schema, /aliasesAr/);
    assert.match(schema, /isVerified/);
  });
});

describe('documentation', () => {
  it('map-places-registry doc explains strategy', () => {
    const doc = readFileSync(join(ROOT, 'docs', 'map-places-registry.md'), 'utf8');
    assert.match(doc, /Local Places Registry/);
    assert.match(doc, /OSM tile labels/);
    assert.match(doc, /Google Maps|Mapbox|MapTiler/);
  });
});
