'use client';

/**
 * useCurrentUser — lightweight client hook for session/user state.
 *
 * - Module-level Promise deduplication for concurrent consumers
 * - Module-level cached user so route transitions do not flash wrong nav
 * - clearCurrentUserCache() on login/register/logout
 */

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import type { DriverState } from '@/lib/roleRoutes';

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
  driverState: DriverState;
}

type MeResult = { user: CurrentUser | null; status: number };

let _sharedPromise: Promise<MeResult> | null = null;
let _cachedUser: CurrentUser | null = null;
let _cachedStatus: number | null = null;
let _cacheEpoch = 0;
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach((l) => l());
}

async function doFetch(): Promise<MeResult> {
  const res = await fetch('/api/me');
  if (!res.ok) return { user: null, status: res.status };
  const json = (await res.json()) as { data?: CurrentUser };
  return { user: json.data ?? null, status: res.status };
}

function getOrStartFetch(force?: boolean): Promise<MeResult> {
  if (force || !_sharedPromise) {
    _sharedPromise = doFetch().then((result) => {
      _cachedUser = result.user;
      _cachedStatus = result.status;
      notifyListeners();
      return result;
    });
  }
  return _sharedPromise;
}

/** Clear cached /api/me state — call after login, register, or logout. */
export function clearCurrentUserCache(): void {
  _sharedPromise = null;
  _cachedUser = null;
  _cachedStatus = null;
  _cacheEpoch += 1;
  notifyListeners();
}

/** Alias for clearCurrentUserCache — forces the next hook mount to refetch. */
export function refetchCurrentUser(): void {
  clearCurrentUserCache();
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function getSnapshot(): number {
  return _cacheEpoch;
}

export function useCurrentUser() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [user, setUser] = useState<CurrentUser | null>(_cachedUser);
  const [loading, setLoading] = useState(_cachedUser === null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(_cachedStatus);

  const load = useCallback((force?: boolean) => {
    if (!force && _cachedUser) {
      setUser(_cachedUser);
      setStatus(_cachedStatus);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getOrStartFetch(force)
      .then(({ user: u, status: s }) => {
        setUser(u);
        setStatus(s);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load session.');
        setStatus(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onCacheChange = () => {
      if (_cachedUser === null && _sharedPromise === null) {
        setUser(null);
        setStatus(null);
        setLoading(true);
        load(true);
        return;
      }
      setUser(_cachedUser);
      setStatus(_cachedStatus);
      if (_cachedUser !== null) setLoading(false);
    };
    _listeners.add(onCacheChange);
    return () => {
      _listeners.delete(onCacheChange);
    };
  }, [load]);

  const refetch = useCallback(() => {
    clearCurrentUserCache();
    load(true);
  }, [load]);

  const isAuthenticated = !loading && user !== null;
  const isUnauthorized = !loading && status === 401;

  return { user, loading, error, status, isAuthenticated, isUnauthorized, refetch };
}
