/** Map place type labels and icons for admin + picker UI. */

import type { MapPlaceType } from '@prisma/client';

export const MAP_PLACE_TYPE_LABELS: Record<MapPlaceType, string> = {
  DISTRICT: 'District',
  SCHOOL: 'School',
  UNIVERSITY: 'University',
  MOSQUE: 'Mosque',
  HOSPITAL: 'Hospital',
  LANDMARK: 'Landmark',
  STREET: 'Street',
  BUILDING: 'Building',
  GATE: 'Gate',
  OTHER: 'Other',
};

export const MAP_PLACE_TYPE_LABELS_AR: Record<MapPlaceType, string> = {
  DISTRICT: 'حي',
  SCHOOL: 'مدرسة',
  UNIVERSITY: 'جامعة',
  MOSQUE: 'مسجد',
  HOSPITAL: 'مستشفى',
  LANDMARK: 'معلم',
  STREET: 'شارع',
  BUILDING: 'مبنى',
  GATE: 'بوابة',
  OTHER: 'أخرى',
};

export function mapPlaceTypeLabel(type: MapPlaceType, lang: 'ar' | 'en' = 'en'): string {
  return lang === 'ar' ? MAP_PLACE_TYPE_LABELS_AR[type] : MAP_PLACE_TYPE_LABELS[type];
}

export const MAP_PLACE_TYPES = Object.keys(MAP_PLACE_TYPE_LABELS) as MapPlaceType[];
