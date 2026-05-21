/**
 * Notification smoke tests — run with: npm test
 * Uses Node.js built-in test runner. No database required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notificationListQuerySchema } from '../lib/validations/notification.ts';

// ─── notificationListQuerySchema ──────────────────────────────────────────────

describe('notificationListQuerySchema', () => {
  it('accepts empty query with defaults', () => {
    const r = notificationListQuerySchema.safeParse({});
    assert.ok(r.success);
    assert.equal(r.data?.page, 1);
    assert.equal(r.data?.limit, 30);
    assert.equal(r.data?.unreadOnly, false);
  });

  it('coerces string page and limit', () => {
    const r = notificationListQuerySchema.safeParse({ page: '3', limit: '10' });
    assert.ok(r.success);
    assert.equal(r.data?.page, 3);
    assert.equal(r.data?.limit, 10);
  });

  it('accepts unreadOnly=true as string', () => {
    const r = notificationListQuerySchema.safeParse({ unreadOnly: 'true' });
    assert.ok(r.success);
    assert.equal(r.data?.unreadOnly, true);
  });

  it('rejects limit above 100', () => {
    const r = notificationListQuerySchema.safeParse({ limit: '101' });
    assert.ok(!r.success);
  });

  it('rejects page less than 1', () => {
    const r = notificationListQuerySchema.safeParse({ page: '0' });
    assert.ok(!r.success);
  });

  it('accepts optional type filter', () => {
    const r = notificationListQuerySchema.safeParse({ type: 'SAFETY' });
    assert.ok(r.success);
    assert.equal(r.data?.type, 'SAFETY');
  });

  it('accepts valid limit of exactly 100', () => {
    const r = notificationListQuerySchema.safeParse({ limit: '100' });
    assert.ok(r.success);
    assert.equal(r.data?.limit, 100);
  });
});

// ─── Authorization logic helpers ──────────────────────────────────────────────

describe('notification ownership check logic', () => {
  const checkOwnership = (notifUserId: string | null, requestingUserId: string): boolean => {
    return notifUserId === requestingUserId;
  };

  it('allows user to access own notification', () => {
    assert.ok(checkOwnership('user-1', 'user-1'));
  });

  it('denies user access to another user notification', () => {
    assert.ok(!checkOwnership('user-2', 'user-1'));
  });

  it('denies access if notification has no userId', () => {
    assert.ok(!checkOwnership(null, 'user-1'));
  });
});

// ─── Unread count logic ───────────────────────────────────────────────────────

describe('unread count logic', () => {
  const updateUnreadCount = (current: number, delta: number): number =>
    Math.max(0, current + delta);

  it('decrements on mark read', () => {
    assert.equal(updateUnreadCount(5, -1), 4);
  });

  it('does not go below zero', () => {
    assert.equal(updateUnreadCount(0, -1), 0);
  });

  it('resets to zero on mark all read', () => {
    assert.equal(updateUnreadCount(10, -10), 0);
  });
});
