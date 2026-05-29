/**
 * Auth redirect and admin-port smoke tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveFamilyLoginRedirect,
  resolveAdminPortLoginRedirect,
} from '../lib/authRedirect.ts';

test('ADMIN from family login goes to /admin', () => {
  assert.equal(resolveFamilyLoginRedirect('ADMIN', undefined, null), '/admin');
});

test('ADMIN from family login honors safe admin from param', () => {
  assert.equal(resolveFamilyLoginRedirect('ADMIN', undefined, '/admin?section=trips'), '/admin?section=trips');
});

test('DRIVER from family login goes to driver dashboard', () => {
  assert.equal(resolveFamilyLoginRedirect('DRIVER', undefined, null), '/driver/dashboard');
});

test('PARENT goes to dashboard', () => {
  assert.equal(resolveFamilyLoginRedirect('PARENT', 'PARENT', null), '/dashboard');
});

test('DRIVER_APPLICANT goes to application', () => {
  assert.equal(resolveFamilyLoginRedirect('PARENT', 'DRIVER_APPLICANT', null), '/driver-application');
});

test('admin-port redirect defaults to /admin', () => {
  assert.equal(resolveAdminPortLoginRedirect(null), '/admin');
});

test('admin-port honors safe admin from param', () => {
  assert.equal(resolveAdminPortLoginRedirect('/admin?section=live-ops'), '/admin?section=live-ops');
});

test('admin-port rejects non-admin from paths', () => {
  assert.equal(resolveAdminPortLoginRedirect('/dashboard'), '/admin');
});

test('family login rejects unsafe from paths', () => {
  assert.equal(resolveFamilyLoginRedirect('PARENT', 'PARENT', 'https://evil.com'), '/dashboard');
  assert.equal(resolveFamilyLoginRedirect('DRIVER', undefined, '/admin'), '/driver/dashboard');
});

test('ADMIN rejects non-admin from param', () => {
  assert.equal(resolveFamilyLoginRedirect('ADMIN', undefined, '/dashboard'), '/admin');
});
