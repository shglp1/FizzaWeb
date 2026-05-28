/**
 * In-memory live ETA cache — throttles ORS/config work to at most once per trip per TTL.
 * Per-process only (no DB). Safe for single-instance or low-scale deploys.
 */

import type { LiveEtaInfo } from './trackingTypes.ts';

export const LIVE_ETA_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  liveEta: LiveEtaInfo | null;
  computedAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedLiveEta(tripId: string, nowMs = Date.now()): LiveEtaInfo | null | undefined {
  const entry = cache.get(tripId);
  if (!entry) return undefined;
  if (nowMs - entry.computedAt > LIVE_ETA_CACHE_TTL_MS) return undefined;
  return entry.liveEta;
}

export function setCachedLiveEta(tripId: string, liveEta: LiveEtaInfo | null, nowMs = Date.now()): void {
  cache.set(tripId, { liveEta, computedAt: nowMs });
}

export function invalidateLiveEtaCache(tripId: string): void {
  cache.delete(tripId);
}

/** Returns cached ETA when fresh; otherwise runs compute(), stores, and returns result. */
export async function getOrComputeLiveEta(
  tripId: string,
  compute: () => Promise<LiveEtaInfo | null>,
  options?: { force?: boolean; nowMs?: number },
): Promise<LiveEtaInfo | null> {
  const nowMs = options?.nowMs ?? Date.now();
  if (!options?.force) {
    const cached = getCachedLiveEta(tripId, nowMs);
    if (cached !== undefined) return cached;
  }
  const liveEta = await compute();
  setCachedLiveEta(tripId, liveEta, nowMs);
  return liveEta;
}

/** Test helper — clear all cached ETAs. */
export function clearLiveEtaCache(): void {
  cache.clear();
}
