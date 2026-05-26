import 'server-only';

import type { MapPlace, MapPlaceType, Prisma } from '@prisma/client';
import type { LocalMapPlaceHit } from './geocodeTypes.ts';
import { normalizeSearchQuery } from './arabicNormalize.ts';
import { haversineDistanceMeters } from '../location/locationDistance.ts';

export type { LocalMapPlaceHit } from './geocodeTypes.ts';

export type MapPlaceBboxHit = {
  id: string;
  label: string;
  type: MapPlaceType;
  latitude: number;
  longitude: number;
  city: string;
  region: string | null;
};

export type MapPlaceListParams = {
  q?: string;
  city?: string;
  type?: string;
  active?: string;
  verified?: string;
  page?: number;
  limit?: number;
};

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

function buildSearchWhere(query: string, lang: 'ar' | 'en'): Prisma.MapPlaceWhereInput {
  const normalized = normalizeSearchQuery(query, lang);
  if (normalized.length < 2) return { AND: [{ id: { in: [] } }] };

  const contains = { contains: normalized };
  const or: Prisma.MapPlaceWhereInput[] =
    lang === 'ar'
      ? [
          { normalizedNameAr: contains },
          { normalizedAliasesAr: contains },
          { normalizedNameEn: contains },
          { normalizedAliasesEn: contains },
        ]
      : [
          { normalizedNameEn: contains },
          { normalizedAliasesEn: contains },
          { normalizedNameAr: contains },
          { normalizedAliasesAr: contains },
        ];

  return { isActive: true, OR: or };
}

/** DB-level local place search — bounded LIMIT, no full-table memory scan. */
export async function searchLocalMapPlaces(
  query: string,
  lang: 'ar' | 'en',
  limit = 8,
): Promise<LocalMapPlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { prisma } = await import('@/lib/prisma');
  const places = await prisma.mapPlace.findMany({
    where: buildSearchWhere(q, lang),
    orderBy: [{ isVerified: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });

  return places.map((p) => mapPlaceToHit(p));
}

function bboxDelta(radiusMeters: number, lat: number) {
  const deltaLat = radiusMeters / 111320;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const deltaLng = radiusMeters / (111320 * cosLat);
  return { deltaLat, deltaLng };
}

/** Find nearest active local place within radius using DB bounding-box prefilter. */
export async function findNearestLocalMapPlace(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<LocalMapPlaceHit | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const { deltaLat, deltaLng } = bboxDelta(radiusMeters, lat);
  const { prisma } = await import('@/lib/prisma');

  const places = await prisma.mapPlace.findMany({
    where: {
      isActive: true,
      latitude: { gte: lat - deltaLat, lte: lat + deltaLat },
      longitude: { gte: lng - deltaLng, lte: lng + deltaLng },
    },
    orderBy: [{ isVerified: 'desc' }, { updatedAt: 'desc' }],
    take: 40,
  });

  let best: { place: MapPlace; dist: number } | null = null;
  for (const place of places) {
    const dist = haversineDistanceMeters(lat, lng, Number(place.latitude), Number(place.longitude));
    if (dist <= radiusMeters && (!best || dist < best.dist)) best = { place, dist };
  }

  return best ? mapPlaceToHit(best.place, best.dist) : null;
}

/** Verified active places inside map bounds for overlay labels. */
export async function listMapPlacesInBbox(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
  options?: { types?: MapPlaceType[]; language?: 'ar' | 'en'; limit?: number },
): Promise<MapPlaceBboxHit[]> {
  const lang = options?.language === 'ar' ? 'ar' : 'en';
  const limit = Math.min(120, Math.max(1, options?.limit ?? 80));

  const { prisma } = await import('@/lib/prisma');
  const places = await prisma.mapPlace.findMany({
    where: {
      isActive: true,
      isVerified: true,
      latitude: { gte: minLat, lte: maxLat },
      longitude: { gte: minLng, lte: maxLng },
      ...(options?.types?.length ? { type: { in: options.types } } : {}),
    },
    orderBy: [{ type: 'asc' }, { nameEn: 'asc' }],
    take: limit,
  });

  return places.map((p) => ({
    id: p.id,
    label: lang === 'ar' ? p.nameAr : p.nameEn,
    type: p.type,
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    city: p.city,
    region: p.region,
  }));
}

/** Paginated admin listing — DB-level filters. */
export async function listMapPlacesPaginated(params: MapPlaceListParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: Prisma.MapPlaceWhereInput = {
    ...(params.city ? { city: { contains: params.city } } : {}),
    ...(params.type ? { type: params.type as MapPlaceType } : {}),
    ...(params.active === 'true' ? { isActive: true } : params.active === 'false' ? { isActive: false } : {}),
    ...(params.verified === 'true'
      ? { isVerified: true }
      : params.verified === 'false'
        ? { isVerified: false }
        : {}),
    ...(params.q?.trim()
      ? {
          OR: [
            { nameAr: { contains: params.q.trim() } },
            { nameEn: { contains: params.q.trim() } },
            { normalizedNameAr: { contains: normalizeSearchQuery(params.q.trim(), 'ar') } },
            { normalizedNameEn: { contains: normalizeSearchQuery(params.q.trim(), 'en') } },
            { city: { contains: params.q.trim() } },
          ],
        }
      : {}),
  };

  const { prisma } = await import('@/lib/prisma');
  const [items, total] = await Promise.all([
    prisma.mapPlace.findMany({
      where,
      orderBy: [{ isVerified: 'desc' }, { city: 'asc' }, { nameEn: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.mapPlace.count({ where }),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

export async function getMapPlaceCounts() {
  const { prisma } = await import('@/lib/prisma');
  const [total, verified, active, cities] = await Promise.all([
    prisma.mapPlace.count(),
    prisma.mapPlace.count({ where: { isVerified: true } }),
    prisma.mapPlace.count({ where: { isActive: true } }),
    prisma.mapPlace.findMany({ select: { city: true }, distinct: ['city'] }),
  ]);
  return { total, verified, inactive: total - active, cities: cities.length };
}
