/**
 * Task 16.2 — Saudi geocoding, reverse geocode, map tiles smoke tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatPlaceLabel,
  formatPlaceSubtitle,
  geocodeProviderBadge,
  SAUDI_RECT,
} from '../lib/maps/geocoding.ts';
import { MAP_TILE_CSP_HOSTS, MAP_TILE_LAYERS } from '../lib/maps/mapTiles.ts';
import {
  confirmedLabelFromReverse,
  providerBadgeLabel,
  suggestionDisplaySubtitle,
  suggestionDisplayTitle,
} from '../lib/location/stableMapPickerHelpers.ts';
import { haversineDistanceMeters, locationsWithinMeters } from '../lib/location/locationDistance.ts';

const ROOT = join(import.meta.dirname, '..', '..');

describe('Saudi geocoding — Nominatim params', () => {
  it('includes countrycodes=sa and accept-language', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'geocoding.ts'), 'utf8');
    assert.match(src, /countrycodes['"],?\s*['"]sa['"]/);
    assert.match(src, /accept-language/);
    assert.match(src, /addressdetails['"],?\s*['"]1['"]/);
  });

  it('limits results to 8 and filters within Saudi rect', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'geocoding.ts'), 'utf8');
    assert.match(src, /DEFAULT_LIMIT = 8/);
    assert.match(src, /withinSaudi/);
    assert.equal(SAUDI_RECT.minLat < 24.7136, true);
    assert.equal(SAUDI_RECT.maxLat > 24.7136, true);
  });
});

describe('Saudi geocoding — ORS params', () => {
  it('applies boundary.country SA and Saudi rect for all languages', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'maps', 'geocoding.ts'), 'utf8');
    assert.match(src, /boundary\.country['"],?\s*['"]SA['"]/);
    assert.match(src, /applySaudiBiasOrs/);
    assert.match(src, /focus\.point\.lon/);
  });
});

describe('reverse geocoding API', () => {
  it('reverse route exists and uses server proxy', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'maps', 'reverse', 'route.ts'), 'utf8');
    assert.match(route, /reverseGeocodeLocation/);
    assert.match(route, /requireAuth/);
    assert.doesNotMatch(route, /OPENROUTESERVICE/);
  });

  it('StableMapPicker calls reverse geocode on pin move', () => {
    const picker = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapPicker.tsx'), 'utf8');
    assert.match(picker, /\/api\/maps\/reverse/);
    assert.match(picker, /scheduleReverseGeocode/);
    assert.match(picker, /handleMapMove/);
  });
});

describe('formatPlaceLabel', () => {
  it('prefers landmark with neighborhood', () => {
    const label = formatPlaceLabel({
      landmark: 'Al-Masjid an-Nabawi',
      neighborhood: 'Al Haram',
      city: 'Medina',
    });
    assert.match(label, /Al-Masjid/);
    assert.match(label, /Medina|Haram/);
  });

  it('preserves Arabic text', () => {
    const label = formatPlaceLabel({
      name: 'جامعة الأمير مقرن',
      city: 'المدينة المنورة',
    });
    assert.match(label, /جامعة الأمير مقرن/);
  });

  it('uses road and neighborhood when no landmark', () => {
    const label = formatPlaceLabel({
      road: 'King Fahd Road',
      neighborhood: 'Al Aziziyah',
      city: 'Medina',
    });
    assert.match(label, /King Fahd Road/);
    assert.match(label, /Al Aziziyah/);
  });
});

describe('search result display', () => {
  it('shows title and subtitle with provider badge', () => {
    const s = {
      label: 'Long full label',
      title: 'University of Prince Mugrin',
      subtitle: 'Medina · Saudi Arabia',
      latitude: 24.5,
      longitude: 39.6,
      provider: 'nominatim',
    };
    assert.equal(suggestionDisplayTitle(s), 'University of Prince Mugrin');
    assert.match(suggestionDisplaySubtitle(s), /Medina/);
    assert.equal(providerBadgeLabel('nominatim'), 'OSM');
    assert.equal(geocodeProviderBadge('openrouteservice'), 'ORS');
  });
});

describe('confirmedLabelFromReverse', () => {
  it('uses reverse label when long enough', () => {
    assert.equal(
      confirmedLabelFromReverse({ label: 'Al Aziziyah District, Medina' }),
      'Al Aziziyah District, Medina',
    );
  });
});

describe('pickup/dropoff proximity warning', () => {
  it('detects locations within 100 meters', () => {
    const a = { lat: 24.7136, lng: 46.6753 };
    const b = { lat: 24.71361, lng: 46.67531 };
    assert.equal(locationsWithinMeters(a, b), true);
    assert.equal(locationsWithinMeters(a, { lat: 24.75, lng: 46.72 }), false);
  });

  it('subscription page shows close-location warning', () => {
    const page = readFileSync(join(ROOT, 'src', 'app', 'subscriptions', 'new', 'page.tsx'), 'utf8');
    assert.match(page, /locationsWithinMeters/);
    assert.match(page, /very close/i);
  });
});

describe('map tile layers and CSP', () => {
  it('defines standard and detailed HOT layers', () => {
    assert.match(MAP_TILE_LAYERS.standard.url, /openstreetmap\.org/);
    assert.match(MAP_TILE_LAYERS.detailed.url, /openstreetmap\.fr\/hot/);
    assert.equal(MAP_TILE_LAYERS.standard.maxZoom, 19);
  });

  it('CSP allows OSM and HOT tile domains without img-src *', () => {
    const config = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
    for (const host of MAP_TILE_CSP_HOSTS) {
      const fragment = host.replace('https://', '');
      assert.match(config, new RegExp(fragment.replace(/\./g, '\\.').replace(/\*/g, '.*')));
    }
    assert.doesNotMatch(config, /img-src \*/);
  });

  it('InnerMap uses configurable tile layers', () => {
    const inner = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapInnerMap.tsx'), 'utf8');
    assert.match(inner, /getMapTileLayer/);
    assert.match(inner, /tileLayerId/);
    assert.match(inner, /maxZoom/);
  });
});

describe('no secret keys client-side', () => {
  it('geocode fetch stays on /api/maps/* without ORS key', () => {
    const picker = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapPicker.tsx'), 'utf8');
    assert.match(picker, /\/api\/maps\/geocode/);
    assert.doesNotMatch(picker, /OPENROUTESERVICE/);
    assert.doesNotMatch(picker, /api\.openrouteservice\.org/);
  });
});

describe('geocode API focus params', () => {
  it('forwards lat/lng focus to searchLocations', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'maps', 'geocode', 'route.ts'), 'utf8');
    assert.match(route, /focusLat/);
    assert.match(route, /searchLocations/);
  });
});

describe('haversineDistanceMeters', () => {
  it('returns zero for identical points', () => {
    assert.equal(haversineDistanceMeters(24.7, 46.6, 24.7, 46.6), 0);
  });
});

describe('formatPlaceSubtitle', () => {
  it('deduplicates city and country', () => {
    const sub = formatPlaceSubtitle({
      city: 'Riyadh',
      region: 'Riyadh Region',
      country: 'Saudi Arabia',
    });
    assert.match(sub, /Riyadh/);
    assert.match(sub, /Saudi Arabia/);
  });
});
