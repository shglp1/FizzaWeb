/** Pure geocode cache helpers — safe for tests/client. */

export function roundCoord(value: number, decimals = 5): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeForwardQuery(query: string, lang: string): string {
  const trimmed = query.trim();
  if (lang === 'ar') return trimmed;
  return trimmed.toLowerCase().replace(/\s+/g, ' ');
}
