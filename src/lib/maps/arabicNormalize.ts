/** Normalize Arabic text for fuzzy place search — pure, testable. */

/** Remove tatweel and normalize common letter variants for matching. */
export function normalizeArabic(text: string): string {
  return text
    .trim()
    .replace(/\u0640/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Normalize English query for case-insensitive partial matching. */
export function normalizeEnglish(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeSearchQuery(query: string, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? normalizeArabic(query) : normalizeEnglish(query);
}

export function textMatchesQuery(haystack: string, query: string, lang: 'ar' | 'en'): boolean {
  const nQuery = normalizeSearchQuery(query, lang);
  if (nQuery.length < 2) return false;
  const nHay = lang === 'ar' ? normalizeArabic(haystack) : normalizeEnglish(haystack);
  return nHay.includes(nQuery);
}
