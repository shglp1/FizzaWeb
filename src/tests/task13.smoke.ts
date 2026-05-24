/**
 * Task 13 — UI/UX polish smoke tests (no emoji in UI, wizard labels, map helpers).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  subscriptionStepLabel,
  SUBSCRIPTION_WIZARD_STEPS,
} from '../lib/ui/subscriptionWizard.ts';
import {
  mapGeoErrorMessage,
  requiresConfirmedPin,
} from '../lib/ui/mapLocation.ts';
test('subscription wizard step labels', () => {
  assert.equal(subscriptionStepLabel(0), 'Plan');
  assert.equal(subscriptionStepLabel(1), 'Rider & Schedule');
  assert.equal(subscriptionStepLabel(2), 'Pickup & Drop-off');
  assert.equal(subscriptionStepLabel(3), 'Price & Add-ons');
  assert.equal(subscriptionStepLabel(4), 'Review');
  assert.deepEqual(SUBSCRIPTION_WIZARD_STEPS.slice(0, 5), [
    'Plan',
    'Rider & Schedule',
    'Pickup & Drop-off',
    'Price & Add-ons',
    'Review',
  ]);
});

test('location pin confirmation helper', () => {
  assert.equal(requiresConfirmedPin(true, false), true);
  assert.equal(requiresConfirmedPin(true, true), false);
  assert.equal(requiresConfirmedPin(false, false), false);
});

test('geolocation error messages are human-friendly', () => {
  assert.match(mapGeoErrorMessage(1), /denied/i);
  assert.match(mapGeoErrorMessage(3), /timed out/i);
});

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const SKIP_DIRS = new Set(['node_modules', '.next', 'tests', 'icons/index.tsx']);
const ALLOWED_FILES = new Set([
  'src/components/icons/index.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP_DIRS.has(name)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

test('no raw emoji in app UI source (except icon map)', () => {
  const roots = ['src/app', 'src/components'].map((d) => join(process.cwd(), d));
  const files = roots.flatMap((root) => walk(root));
  const offenders: string[] = [];
  for (const file of files) {
    const rel = file.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
    if (ALLOWED_FILES.has(rel.replace(/\\/g, '/'))) continue;
    const text = readFileSync(file, 'utf8').replace(/©/g, '');
    if (EMOJI_RE.test(text)) offenders.push(rel);
  }
  assert.equal(
    offenders.length,
    0,
    `Emoji found in UI files:\n${offenders.slice(0, 15).join('\n')}${offenders.length > 15 ? `\n...and ${offenders.length - 15} more` : ''}`,
  );
});
