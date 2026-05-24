/** Client-side pagination utilities for admin list pages. */

export const ADMIN_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_ADMIN_PAGE_LIMIT = 10;
export const MAX_ADMIN_PAGE_LIMIT = 50;

export type AdminPaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export function clampPageLimit(limit: number, max = MAX_ADMIN_PAGE_LIMIT): number {
  return Math.min(max, Math.max(1, limit));
}

export function calcPaginationRange(
  page: number,
  limit: number,
  total: number,
): { start: number; end: number; total: number } {
  if (total <= 0) return { start: 0, end: 0, total: 0 };
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return { start, end, total };
}

export function paginateClientList<T>(items: T[], page: number, limit: number): T[] {
  const safeLimit = clampPageLimit(limit);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * safeLimit;
  return items.slice(start, start + safeLimit);
}

export function clientPaginationMeta(total: number, page: number, limit: number): AdminPaginationMeta {
  const safeLimit = clampPageLimit(limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
