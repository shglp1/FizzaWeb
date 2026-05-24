'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  calcPaginationRange,
  type AdminPaginationMeta,
} from '@/lib/ui/adminPagination';

export type AdminPaginationProps = {
  meta: AdminPaginationMeta | null;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  className?: string;
  /** Show even when only one page (displays range). Default true. */
  alwaysShow?: boolean;
};

export function AdminPagination({
  meta,
  onPageChange,
  onLimitChange,
  className = '',
  alwaysShow = true,
}: AdminPaginationProps) {
  if (!meta) return null;
  if (!alwaysShow && meta.totalPages <= 1 && meta.total <= meta.limit) return null;

  const { start, end, total } = calcPaginationRange(meta.page, meta.limit, meta.total);
  const hasPrev = meta.hasPrev ?? meta.page > 1;
  const hasNext = meta.hasNext ?? meta.page < meta.totalPages;

  return (
    <nav
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-label="Pagination"
    >
      <p className="text-xs text-gray-500 tabular-nums order-2 sm:order-1">
        {total === 0 ? 'Showing 0 of 0' : `Showing ${start}–${end} of ${total}`}
      </p>

      <div className="flex flex-wrap items-center gap-2 order-1 sm:order-2">
        {onLimitChange && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="sr-only">Items per page</span>
            <select
              value={meta.limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 min-h-[44px] sm:min-h-[36px] sm:py-1.5"
              aria-label="Items per page"
            >
              {ADMIN_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={!hasPrev}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-0.5">Prev</span>
          </button>

          <span className="px-2 text-xs font-medium text-gray-600 tabular-nums min-w-[4.5rem] text-center">
            Page {meta.page} of {meta.totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={!hasNext}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            aria-label="Next page"
          >
            <span className="hidden sm:inline mr-0.5">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
