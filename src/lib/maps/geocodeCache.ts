import 'server-only';

import type { GeocodeSearchResult, ReverseGeocodeResult } from './geocodeTypes.ts';
import { normalizeForwardQuery, roundCoord } from './geocodeCacheUtils.ts';
import type { Prisma } from '@prisma/client';

const SUCCESS_TTL_DAYS = Number(process.env.MAP_GEOCODE_CACHE_DAYS ?? '14');
const FAILURE_TTL_MINUTES = 10;

function successExpiry(): Date {
  const days = Number.isFinite(SUCCESS_TTL_DAYS) && SUCCESS_TTL_DAYS > 0 ? SUCCESS_TTL_DAYS : 14;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function failureExpiry(): Date {
  return new Date(Date.now() + FAILURE_TTL_MINUTES * 60 * 1000);
}

export { roundCoord, normalizeForwardQuery } from './geocodeCacheUtils.ts';

export async function getForwardGeocodeCache(
  query: string,
  lang: string,
  provider: string,
): Promise<GeocodeSearchResult[] | null> {
  const normalizedQuery = normalizeForwardQuery(query, lang);
  const { prisma } = await import('@/lib/prisma');
  const row = await prisma.mapGeocodeCache.findFirst({
    where: {
      kind: 'FORWARD',
      normalizedQuery,
      language: lang,
      provider,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return null;
  const json = row.resultJson;
  return Array.isArray(json) ? (json as unknown as GeocodeSearchResult[]) : null;
}

export async function setForwardGeocodeCache(
  query: string,
  lang: string,
  provider: string,
  results: GeocodeSearchResult[],
  ok = true,
): Promise<void> {
  const normalizedQuery = normalizeForwardQuery(query, lang);
  const { prisma } = await import('@/lib/prisma');
  await prisma.mapGeocodeCache.create({
    data: {
      kind: 'FORWARD',
      query: query.trim().slice(0, 500),
      normalizedQuery,
      language: lang,
      provider,
      resultJson: results as unknown as Prisma.InputJsonValue,
      expiresAt: ok ? successExpiry() : failureExpiry(),
    },
  });
}

export async function getReverseGeocodeCache(
  lat: number,
  lng: number,
  lang: string,
  provider: string,
): Promise<ReverseGeocodeResult | null> {
  const roundedLat = roundCoord(lat);
  const roundedLng = roundCoord(lng);
  const { prisma } = await import('@/lib/prisma');
  const row = await prisma.mapGeocodeCache.findFirst({
    where: {
      kind: 'REVERSE',
      roundedLat,
      roundedLng,
      language: lang,
      provider,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row || !row.resultJson || typeof row.resultJson !== 'object') return null;
  return row.resultJson as unknown as ReverseGeocodeResult;
}

export async function setReverseGeocodeCache(
  lat: number,
  lng: number,
  lang: string,
  provider: string,
  result: ReverseGeocodeResult | null,
  ok = true,
): Promise<void> {
  const roundedLat = roundCoord(lat);
  const roundedLng = roundCoord(lng);
  const { prisma } = await import('@/lib/prisma');
  await prisma.mapGeocodeCache.create({
    data: {
      kind: 'REVERSE',
      roundedLat,
      roundedLng,
      language: lang,
      provider,
      resultJson: (result ?? {}) as unknown as Prisma.InputJsonValue,
      expiresAt: ok && result ? successExpiry() : failureExpiry(),
    },
  });
}

export async function getGeocodeCacheStats(): Promise<{ total: number; active: number; expired: number }> {
  const { prisma } = await import('@/lib/prisma');
  const now = new Date();
  const [total, active] = await Promise.all([
    prisma.mapGeocodeCache.count(),
    prisma.mapGeocodeCache.count({ where: { expiresAt: { gt: now } } }),
  ]);
  return { total, active, expired: total - active };
}
