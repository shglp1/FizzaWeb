/**
 * Task 13.5 — Parent portal enterprise UI smoke tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { PARENT_NAV } from '../lib/roleRoutes.ts';
import { getMobileNavConfigForDriverState, getMobileNavItemsForDriverState } from '../lib/mobileNav.ts';
import { CONFIG_FIELD_META, CONFIG_GROUPS } from '../lib/ui/systemConfigGroups.ts';
import { DEFAULT_CHAT_CONFIG, chatUnavailableLabel } from '../lib/chat/chatConfig.ts';
import { isChatWindowOpen } from '../lib/trips/tripLifecycle.ts';
import {
  hasSpecialNeedsIndicator,
  riderForDriverView,
  riderForAdminView,
  formatDriverRiderMeta,
} from '../lib/riders/riderExposure.ts';
import { formatSarParent, formatSubscriptionRoute } from '../lib/parent/parentFormatters.ts';

const root = join(import.meta.dirname, '..');

test('parent desktop nav labels', () => {
  const labels = PARENT_NAV.map((n) => n.label);
  assert.ok(labels.includes('Dashboard'));
  assert.ok(labels.includes('Riders'));
  assert.ok(labels.includes('Subscriptions'));
  assert.ok(labels.includes('Trips'));
  assert.ok(labels.includes('Wallet'));
  assert.ok(labels.includes('Safety'));
});

test('parent mobile nav items', () => {
  const config = getMobileNavConfigForDriverState('PARENT');
  assert.ok(config);
  const barHrefs = config!.bar.map((i) => i.href);
  assert.ok(barHrefs.includes('/dashboard'));
  assert.ok(barHrefs.includes('/riders'));
  assert.ok(barHrefs.includes('/subscriptions'));
  assert.ok(barHrefs.includes('/trips'));
  assert.ok(barHrefs.includes('__more__'));
  const moreHrefs = config!.more.map((i) => i.href);
  assert.ok(moreHrefs.includes('/wallet'));
  assert.ok(moreHrefs.includes('/safety'));
  assert.ok(moreHrefs.includes('/notifications'));
  assert.ok(moreHrefs.includes('/profile'));
});

test('rider sensitive info withheld from driver view', () => {
  const rider = {
    id: '1',
    name: 'Sara',
    school: 'Al-Noor',
    grade: '3',
    specialNeeds: true,
    medicalNotes: 'Asthma inhaler',
    allergies: 'Peanuts',
    pickupNotes: 'Gate 2',
    dropoffNotes: 'Main entrance',
    emergencyContactName: 'Mom',
    emergencyContactPhone: '+966500000000',
  };
  const driverView = riderForDriverView(rider);
  assert.equal(driverView.name, 'Sara');
  assert.equal(driverView.pickupNotes, 'Gate 2');
  assert.ok(!('medicalNotes' in driverView));
  assert.ok(!('allergies' in driverView));
  assert.equal(riderForAdminView(rider).medicalNotes, 'Asthma inhaler');
});

test('special needs indicator helper', () => {
  assert.ok(hasSpecialNeedsIndicator({ specialNeeds: true }));
  assert.ok(!hasSpecialNeedsIndicator({ specialNeeds: false }));
});

test('driver rider meta formatter', () => {
  assert.match(formatDriverRiderMeta({ school: 'School A', grade: '5', specialNeeds: true }), /Special needs/);
});

test('subscription route summary formatter', () => {
  const s = formatSubscriptionRoute('Home Street', 'School Avenue');
  assert.ok(s.includes('→'));
});

test('chat config keys in system config groups', () => {
  const chatGroup = CONFIG_GROUPS.find((g) => g.id === 'chat');
  assert.ok(chatGroup);
  assert.ok(chatGroup!.keys.includes('chatOpenMinutesBeforePickup'));
  assert.ok(chatGroup!.keys.includes('chatCloseMinutesAfterDropoff'));
  assert.ok(CONFIG_FIELD_META.chatOpenMinutesBeforePickup);
});

test('chat availability uses config timing not hardcoded 20 only', () => {
  const pickupIn30 = new Date(Date.now() + 30 * 60 * 1000);
  assert.ok(!isChatWindowOpen(pickupIn30, 'DRIVER_ASSIGNED', null, null, Date.now(), null, { openMinutesBeforePickup: 20 }));
  assert.ok(isChatWindowOpen(pickupIn30, 'DRIVER_ASSIGNED', null, null, Date.now(), null, { openMinutesBeforePickup: 45 }));
  assert.equal(DEFAULT_CHAT_CONFIG.chatOpenMinutesBeforePickup, 20);
  assert.equal(DEFAULT_CHAT_CONFIG.chatCloseMinutesAfterDropoff, 60);
  assert.match(chatUnavailableLabel(25), /25 minutes/);
});

test('map marker uses DivIcon not default Leaflet PNG', () => {
  const src = readFileSync(join(root, 'components/location/MapLocationPicker.tsx'), 'utf8');
  assert.ok(src.includes('divIcon'));
  assert.ok(!src.includes('marker-icon.png'));
});

test('wallet SAR formatting X.XX', () => {
  assert.equal(formatSarParent(10), 'SAR 10.00');
  assert.equal(formatSarParent('12.5'), 'SAR 12.50');
});

test('parent UI files avoid emoji', () => {
  const parentUi = readFileSync(join(root, 'components/parent/ParentUI.tsx'), 'utf8');
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(parentUi));
});
