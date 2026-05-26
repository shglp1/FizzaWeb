/** Compute normalized search fields for MapPlace — pure, testable. */

import { normalizeArabic, normalizeEnglish } from './arabicNormalize.ts';

export type MapPlaceNormalizedInput = {
  nameAr: string;
  nameEn: string;
  aliasesAr?: string[] | unknown;
  aliasesEn?: string[] | unknown;
};

function parseAliases(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === 'string');
}

function normalizeAliasesList(aliases: string[], lang: 'ar' | 'en'): string {
  return aliases
    .map((a) => (lang === 'ar' ? normalizeArabic(a) : normalizeEnglish(a)))
    .filter(Boolean)
    .join(' ');
}

export function buildMapPlaceNormalizedFields(input: MapPlaceNormalizedInput) {
  const aliasesAr = parseAliases(input.aliasesAr);
  const aliasesEn = parseAliases(input.aliasesEn);

  return {
    normalizedNameAr: normalizeArabic(input.nameAr),
    normalizedNameEn: normalizeEnglish(input.nameEn),
    normalizedAliasesAr: normalizeAliasesList(aliasesAr, 'ar'),
    normalizedAliasesEn: normalizeAliasesList(aliasesEn, 'en'),
  };
}

export function mapPlaceDataWithNormalized<T extends MapPlaceNormalizedInput>(data: T) {
  return { ...data, ...buildMapPlaceNormalizedFields(data) };
}
