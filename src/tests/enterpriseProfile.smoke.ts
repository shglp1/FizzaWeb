/**
 * Profile page role section smoke tests (source inspection).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const profilePage = readFileSync(join(process.cwd(), 'src/app/profile/page.tsx'), 'utf8');

test('parent sees family account section', () => {
  assert.ok(profilePage.includes('Family account'));
  assert.ok(profilePage.includes('/riders'));
  assert.ok(profilePage.includes('/wallet'));
  assert.ok(profilePage.includes('/trips'));
});

test('driver sees approved driver section', () => {
  assert.ok(profilePage.includes('APPROVED_DRIVER'));
  assert.ok(profilePage.includes('/driver/earnings'));
  assert.ok(profilePage.includes('/tracking'));
});

test('admin sees admin panel only', () => {
  assert.ok(profilePage.includes("role === 'ADMIN'"));
  assert.ok(profilePage.includes('/admin'));
  assert.ok(!profilePage.includes("role === 'ADMIN' && driverState === 'PARENT'"));
});

test('parent section hidden for admin role', () => {
  assert.ok(profilePage.includes("role === 'PARENT' && driverState === 'PARENT'"));
});
