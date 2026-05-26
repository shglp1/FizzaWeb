/**
 * Task 16 — Stable map picker smoke tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDivIconHtml,
  isValidConfirmedLocation,
  mapPickerCopy,
  mapPickerSectionTitle,
  sanitizeManualLabel,
  subscriptionStepRequiresLocations,
} from '../lib/location/stableMapPickerHelpers.ts';
import { SUBSCRIPTION_STEP_COPY } from '../lib/ui/subscriptionWizard.ts';

const ROOT = join(import.meta.dirname, '..', '..');

describe('mapPickerCopy', () => {
  it('provides EN and AR labels for pickup/dropoff', () => {
    assert.match(mapPickerCopy('en').pickupTitle, /Pickup/i);
    assert.match(mapPickerCopy('ar').dropoffTitle, /الوصول/);
  });

  it('section titles match mode', () => {
    assert.match(mapPickerSectionTitle('pickup', 'en'), /Pickup/i);
    assert.match(mapPickerSectionTitle('dropoff', 'en'), /Drop-off/i);
  });
});

describe('confirmed location validation', () => {
  it('requires label and valid lat/lng', () => {
    assert.equal(isValidConfirmedLocation(null), false);
    assert.equal(isValidConfirmedLocation({ label: '', lat: 24, lng: 46 }), false);
    assert.equal(isValidConfirmedLocation({ label: 'Home', lat: 24.7, lng: 46.6 }), true);
  });

  it('step 3 requires both pickup and dropoff', () => {
    const one = { label: 'A', lat: 24, lng: 46 };
    assert.equal(subscriptionStepRequiresLocations(one, null), false);
    assert.equal(subscriptionStepRequiresLocations(one, { label: 'B', lat: 24.1, lng: 46.1 }), true);
  });
});

describe('sanitizeManualLabel', () => {
  it('preserves Arabic and strips HTML', () => {
    const ar = sanitizeManualLabel('حي النرجس <b>test</b>');
    assert.match(ar, /حي النرجس/);
    assert.doesNotMatch(ar, /[<>]/);
  });
});

describe('StableMapPicker — no default Leaflet PNG markers', () => {
  it('uses divIcon HTML only', () => {
    const picker = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapPicker.tsx'), 'utf8');
    const inner = readFileSync(join(ROOT, 'src', 'components', 'location', 'StableMapInnerMap.tsx'), 'utf8');
    assert.doesNotMatch(picker, /marker-icon\.png/);
    assert.doesNotMatch(inner, /marker-icon\.png/);
    assert.doesNotMatch(inner, /Icon\.Default/);
    assert.match(inner, /divIcon/);
    assert.match(inner, /fizza-map-marker/);
  });

  it('buildDivIconHtml produces inline marker', () => {
    assert.match(buildDivIconHtml('#059669'), /background:#059669/);
  });
});

describe('subscription wizard copy', () => {
  it('has single pickup step title (no duplicate headings in step copy)', () => {
    const pickupSteps = SUBSCRIPTION_STEP_COPY.filter((s) => /pickup/i.test(s.title));
    assert.equal(pickupSteps.length, 1);
  });
});

describe('subscriptions/new uses StableMapPicker', () => {
  it('does not import MapLocationPicker', () => {
    const page = readFileSync(join(ROOT, 'src', 'app', 'subscriptions', 'new', 'page.tsx'), 'utf8');
    assert.doesNotMatch(page, /MapLocationPicker/);
    assert.match(page, /StableMapPicker/);
  });
});

describe('globals.css leaflet setup', () => {
  it('imports bundled leaflet CSS and hides default marker sprite', () => {
    const css = readFileSync(join(ROOT, 'src', 'styles', 'globals.css'), 'utf8');
    assert.match(css, /leaflet\/dist\/leaflet\.css/);
    assert.match(css, /\.fizza-map-marker/);
    assert.match(css, /\.stable-map-canvas/);
  });
});
