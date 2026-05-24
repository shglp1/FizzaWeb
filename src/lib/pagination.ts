/** Shared server-side pagination helpers for admin list APIs. */

export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 50;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options?: { defaultLimit?: number; maxLimit?: number },
): { page: number; limit: number; skip: number } {
  const defaultLimit = options?.defaultLimit ?? DEFAULT_PAGE_LIMIT;
  const maxLimit = options?.maxLimit ?? MAX_PAGE_LIMIT;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(defaultLimit), 10)),
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
