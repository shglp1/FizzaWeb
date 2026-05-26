import type { MapPlaceCreateInput, MapPlaceUpdateInput } from '@/lib/validations/mapPlace';
import { buildMapPlaceNormalizedFields } from '@/lib/maps/mapPlaceNormalize';

export function buildMapPlaceCreateData(d: MapPlaceCreateInput, userId: string) {
  const normalized = buildMapPlaceNormalizedFields({
    nameAr: d.nameAr,
    nameEn: d.nameEn,
    aliasesAr: d.aliasesAr,
    aliasesEn: d.aliasesEn,
  });

  return {
    nameAr: d.nameAr,
    nameEn: d.nameEn,
    type: d.type,
    city: d.city,
    region: d.region?.trim() || null,
    country: d.country ?? 'SA',
    latitude: d.latitude,
    longitude: d.longitude,
    aliasesAr: d.aliasesAr ?? [],
    aliasesEn: d.aliasesEn ?? [],
    ...normalized,
    isActive: d.isActive ?? true,
    isVerified: d.isVerified ?? false,
    notes: d.notes?.trim() || null,
    createdById: userId,
    updatedById: userId,
  };
}

export function buildMapPlaceUpdateData(d: MapPlaceUpdateInput, userId: string, existing: {
  nameAr: string;
  nameEn: string;
  aliasesAr: unknown;
  aliasesEn: unknown;
}) {
  const nameAr = d.nameAr ?? existing.nameAr;
  const nameEn = d.nameEn ?? existing.nameEn;
  const aliasesAr = d.aliasesAr ?? existing.aliasesAr;
  const aliasesEn = d.aliasesEn ?? existing.aliasesEn;
  const normalized = buildMapPlaceNormalizedFields({ nameAr, nameEn, aliasesAr, aliasesEn });

  return {
    ...(d.nameAr != null ? { nameAr: d.nameAr } : {}),
    ...(d.nameEn != null ? { nameEn: d.nameEn } : {}),
    ...(d.type != null ? { type: d.type } : {}),
    ...(d.city != null ? { city: d.city } : {}),
    ...(d.region !== undefined ? { region: d.region?.trim() || null } : {}),
    ...(d.country != null ? { country: d.country } : {}),
    ...(d.latitude != null ? { latitude: d.latitude } : {}),
    ...(d.longitude != null ? { longitude: d.longitude } : {}),
    ...(d.aliasesAr !== undefined ? { aliasesAr: d.aliasesAr ?? [] } : {}),
    ...(d.aliasesEn !== undefined ? { aliasesEn: d.aliasesEn ?? [] } : {}),
    ...normalized,
    ...(d.isActive != null ? { isActive: d.isActive } : {}),
    ...(d.isVerified != null ? { isVerified: d.isVerified } : {}),
    ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
    updatedById: userId,
  };
}
