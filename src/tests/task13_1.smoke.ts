/**
 * Task 13.1 — Real frontend redesign smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  SUBSCRIPTION_WIZARD_STEPS,
  SUBSCRIPTION_WIZARD_STEP_COUNT,
  subscriptionStepLabel,
} from '../lib/ui/subscriptionWizard.ts';
import { classifyTripForBoard } from '../lib/ui/adminOperations.ts';
import { groupTripsByDate, DRIVER_ROUTE_TABS } from '../lib/ui/driverRouteSheet.ts';
import { requiresConfirmedPin, mapGeoErrorMessage } from '../lib/ui/mapLocation.ts';

test('subscription wizard has 5 steps', () => {
  assert.equal(SUBSCRIPTION_WIZARD_STEP_COUNT, 5);
  assert.equal(SUBSCRIPTION_WIZARD_STEPS.length, 5);
  assert.equal(subscriptionStepLabel(4), 'Review');
  assert.deepEqual([...SUBSCRIPTION_WIZARD_STEPS], [
    'Plan',
    'Rider & Schedule',
    'Pickup & Drop-off',
    'Price & Add-ons',
    'Review',
  ]);
});

test('admin board classifies unassigned scheduled trips as attention', () => {
  assert.equal(classifyTripForBoard({ status: 'SCHEDULED', driver: null }), 'attention');
  assert.equal(classifyTripForBoard({ status: 'DRIVER_ASSIGNED', driver: { id: '1' } }), 'scheduled');
  assert.equal(classifyTripForBoard({ status: 'ON_THE_WAY', driver: {} }), 'active');
});

test('driver route sheet groups by date', () => {
  const map = groupTripsByDate([
    { scheduledDate: '2026-05-22T00:00:00.000Z' },
    { scheduledDate: '2026-05-23T00:00:00.000Z' },
    { scheduledDate: '2026-05-22T12:00:00.000Z' },
  ]);
  assert.equal(map.size, 2);
  assert.equal(map.get('2026-05-22')?.length, 2);
});

test('driver route tabs include today and active', () => {
  assert.ok(DRIVER_ROUTE_TABS.includes('today'));
  assert.ok(DRIVER_ROUTE_TABS.includes('active'));
});

test('map location helpers', () => {
  assert.equal(requiresConfirmedPin(true, false), true);
  assert.match(mapGeoErrorMessage(1), /denied/i);
});

const EMOJI_RE = /\p{Extended_Pictographic}/u;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next' || name === 'tests') continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

test('no emoji in UI TSX files', () => {
  const roots = ['src/app', 'src/components'].map((d) => join(process.cwd(), d));
  const offenders: string[] = [];
  for (const file of roots.flatMap((r) => walk(r))) {
    const rel = file.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
    const text = readFileSync(file, 'utf8').replace(/©/g, '');
    if (EMOJI_RE.test(text)) offenders.push(rel);
  }
  assert.equal(offenders.length, 0, offenders.join('\n'));
});
