'use client';

import type { ReactNode } from 'react';

/** Mobile-first summary row — label stacked above value for narrow screens. */
export function SummaryInfoRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`py-3 border-b border-gray-100 last:border-0 ${className}`}>
      <dt className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 min-w-0 break-words leading-relaxed">{value}</dd>
    </div>
  );
}

/** Two-column price/detail row — stacks on very narrow screens when needed. */
export function DetailRow({
  label,
  value,
  emphasis = false,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1 sm:gap-x-4 sm:items-start py-2',
        emphasis ? 'font-semibold' : '',
        className,
      ].join(' ')}
    >
      <span className={`text-gray-600 min-w-0 ${emphasis ? 'text-emerald-800' : ''}`}>{label}</span>
      <span
        className={[
          'font-medium tabular-nums sm:text-right shrink-0',
          emphasis ? 'text-emerald-700 text-base' : 'text-gray-900',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
