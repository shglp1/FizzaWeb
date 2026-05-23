'use client';

/**
 * useCurrentUser — lightweight client hook for session/user state.
 *
 * Design:
 *   - Fetches GET /api/me once per page lifecycle using a module-level
 *     Promise singleton, so multiple consumers (Sidebar, MobileNav, …)
 *     share a single HTTP request even though each has its own React state.
 *   - `refetch()` forces a new request and notifies all active instances.
 *   - No React Context or Provider required; the deduplication lives in the
 *     module scope instead.
 *
 * This replaces the old two-call pattern:
 *   1) fetch('/api/me')              → role
 *   2) fetch('/api/driver-application') → application status
 * …with a single call whose response already contains `driverState`.
 */

import { useEffect, useState, useCallback } from 'react';
import type { DriverState } from '@/lib/roleRoutes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { DriverState };

export interface CurrentUser {
  userId: string;
  role: 'PARENT' | 'DRIVER' | 'ADMIN';
  profile?: {
    fullName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  driverApplication?: {
    id: string;
    status: 'PENDING' | 'NEEDS_CHANGES' | 'REJECTED' | 'APPROVED';
    adminResponse?: string | null;
    updatedAt?: string;
  } | null;
  /** Computed UX state — use this to select navigation and chips. */
  driverState: DriverState;
}

// ─── Module-level request deduplication ──────────────────────────────────────
// When the first component calls load(), a Promise is stored here.
// Subsequent calls within the same page lifecycle reuse the same Promise
// (i.e., zero extra HTTP requests). refetch() replaces it with a fresh one.

let _sharedPromise: Promise<CurrentUser | null> | null = null;

async function doFetch(): Promise<CurrentUser | null> {
  const res = await fetch('/api/me');
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: CurrentUser };
  return json.data ?? null;
}

function getOrStartFetch(force?: boolean): Promise<CurrentUser | null> {
  if (force || !_sharedPromise) {
    _sharedPromise = doFetch();
  }
  return _sharedPromise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  const [user,    setUser]    = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback((force?: boolean) => {
    setLoading(true);
    setError(null);
    getOrStartFetch(force)
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load session.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Force a new /api/me request and update all hook instances. */
  const refetch = useCallback(() => {
    load(true);
  }, [load]);

  return { user, loading, error, refetch };
}
