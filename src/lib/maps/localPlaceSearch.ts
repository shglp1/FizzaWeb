import 'server-only';

import type { MapPlace } from '@prisma/client';
import type { LocalMapPlaceHit } from './geocodeTypes.ts';
import { textMatchesQuery } from './arabicNormalize.ts';
import { haversineDistanceMeters } from '../location/locationDistance.ts';

export type { LocalMapPlaceHit } from './geocodeTypes.ts';

function parseAliases(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === 'string');
}

function placeMatchesQuery(place: MapPlace, query: string, lang: 'ar' | 'en'): boolean {
  const fields =
    lang === 'ar'
      ? [place.nameAr, ...parseAliases(place.aliasesAr)]
      : [place.nameEn, ...parseAliases(place.aliasesEn)];

  if (fields.some((f) => textMatchesQuery(f, query, lang))) return true;

  // Cross-language fallback for mixed queries
  const otherFields =
    lang === 'ar'
      ? [place.nameEn, ...parseAliases(place.aliasesEn)]
      : [place.nameAr, ...parseAliases(place.aliasesAr)];

  return otherFields.some((f) => textMatchesQuery(f, query, lang));
}

function scoreMatch(place: MapPlace, query: string, lang: 'ar' | 'en'): number {
  const primary = lang === 'ar' ? place.nameAr : place.nameEn;
  const nQuery = query.trim().toLowerCase();
  let score = 0;
  if (place.isVerified) score += 20;
  if (primary.toLowerCase().includes(nQuery) || textMatchesQuery(primary, query, lang)) score += 10;
  if (placeMatchesQuery(place, query, lang)) score += 5;
  return score;
}

export function mapPlaceToHit(place: MapPlace, distanceMeters?: number): LocalMapPlaceHit {
  return {
    id: place.id,
    nameAr: place.nameAr,
    nameEn: place.nameEn,
    type: place.type,
    city: place.city,
    region: place.region,
    country: place.country,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    isVerified: place.isVerified,
    distanceMeters,
  };
}

/** Search active places in the local registry (in-memory match — fine for hundreds of rows). */
export async function searchLocalMapPlaces(
  query: string,
  lang: 'ar' | 'en',
  limit = 8,
): Promise<LocalMapPlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { prisma } = await import('@/lib/prisma');
  const places = await prisma.mapPlace.findMany({
    where: { isActive: true },
    orderBy: [{ isVerified: 'desc' }, { updatedAt: 'desc' }],
  });

  return places
    .filter((p) => placeMatchesQuery(p, q, lang))
    .sort((a, b) => scoreMatch(b, q, lang) - scoreMatch(a, q, lang))
    .slice(0, limit)
    .map((p) => mapPlaceToHit(p));
}

/** Find the nearest active local place within radius meters. */
export async function findNearestLocalMapPlace(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<LocalMapPlaceHit | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const { prisma } = await import('@/lib/prisma');
  const places = await prisma.mapPlace.findMany({
    where: { isActive: true },
    orderBy: [{ isVerified: 'desc' }, { updatedAt: 'desc' }],
  });

  let best: { place: MapPlace; dist: number } | null = null;

  for (const place of places) {
    const plat = Number(place.latitude);
    const plng = Number(place.longitude);
    const dist = haversineDistanceMeters(lat, lng, plat, plng);
    if (dist <= radiusMeters && (!best || dist < best.dist)) {
      best = { place, dist };
    }
  }

  return best ? mapPlaceToHit(best.place, best.dist) : null;
}
