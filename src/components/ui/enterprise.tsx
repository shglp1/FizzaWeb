'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// ─── PageContainer ─────────────────────────────────────────────────────────────

export function PageContainer({
  children,
  className = '',
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  /** max-w-3xl for forms */
  narrow?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full ${narrow ? 'max-w-3xl' : 'max-w-6xl'} px-0 sm:px-0 ${className}`}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4 ${className}`}>
      <div>
        <h2 className="text-base font-semibold text-gray-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

// ─── EnterpriseCard ────────────────────────────────────────────────────────────

export function EnterpriseCard({
  children,
  className = '',
  header,
  footer,
  accent = false,
  padding = 'default',
}: {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  accent?: boolean;
  padding?: 'none' | 'sm' | 'default' | 'lg';
}) {
  const padMap = {
    none: '',
    sm: 'p-4',
    default: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };
  const pad = padMap[padding];
  const insetPad = 'px-4 sm:px-5';
  const headerPad = header
    ? padding === 'none'
      ? `${insetPad} pt-4 sm:pt-5 pb-3`
      : `${pad} pb-4`
    : '';
  const bodyPad =
    padding === 'none'
      ? header || footer
        ? `${insetPad} pb-4 sm:pb-5`
        : ''
      : pad;
  const footerPad = footer
    ? padding === 'none'
      ? `${insetPad} pt-4 pb-4 sm:pb-5 border-t border-gray-100`
      : `${pad} pt-4 border-t border-gray-100`
    : '';

  return (
    <div
      className={[
        'rounded-2xl border bg-white shadow-card transition-shadow',
        accent ? 'border-emerald-200/80 ring-1 ring-emerald-100' : 'border-gray-100',
        className,
      ].join(' ')}
    >
      {header && <div className={`border-b border-gray-100 ${headerPad}`}>{header}</div>}
      <div className={header || footer ? bodyPad : pad}>{children}</div>
      {footer && <div className={footerPad}>{footer}</div>}
    </div>
  );
}

// ─── InfoRow / DataCard ────────────────────────────────────────────────────────

export function InfoRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 sm:flex-row sm:gap-4 sm:items-start py-2 border-b border-gray-50 last:border-0 ${className}`}>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide sm:w-32 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 flex-1 min-w-0 break-words">{value}</dd>
    </div>
  );
}

export function DataCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <EnterpriseCard
      header={
        <SectionHeader title={title} action={action} className="mb-0" />
      }
      padding="none"
    >
      <dl className="px-5 sm:px-6 pb-5 sm:pb-6">{children}</dl>
    </EnterpriseCard>
  );
}

// ─── ActionBar ─────────────────────────────────────────────────────────────────

export function ActionBar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end pt-5 mt-6 border-t border-gray-100 ${className}`}
    >
      {children}
    </div>
  );
}

// ─── FormSection ───────────────────────────────────────────────────────────────

export function FormSection({
  title,
  description,
  children,
  error,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>}
      </div>
      {children}
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
    </section>
  );
}

// ─── StatsGrid ─────────────────────────────────────────────────────────────────

export function StatsGrid({
  items,
  columns = 4,
}: {
  items: {
    label: string;
    value: string | number;
    helper?: string;
    icon?: LucideIcon;
    color?: string;
  }[];
  columns?: 2 | 3 | 4 | 7;
}) {
  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    7: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
  }[columns];

  return (
    <div className={`grid ${colClass} gap-3 sm:gap-4`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card hover:shadow-card-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</p>
              {Icon && (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-fizza-secondary"
                  style={item.color ? { backgroundColor: `${item.color}18`, color: item.color } : undefined}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate" style={item.color ? { color: item.color } : undefined}>
              {item.value}
            </p>
            {item.helper && <p className="text-xs text-gray-400 mt-1">{item.helper}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Timeline ──────────────────────────────────────────────────────────────────

export type TimelineItem = {
  id: string;
  title: string;
  subtitle?: string;
  time?: string;
  status?: 'done' | 'current' | 'upcoming' | 'error';
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-0">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const dot =
          item.status === 'done' ? 'bg-emerald-500 border-emerald-500'
          : item.status === 'current' ? 'bg-white border-emerald-500 ring-4 ring-emerald-100'
          : item.status === 'error' ? 'bg-red-500 border-red-500'
          : 'bg-white border-gray-300';
        return (
          <li key={item.id} className="flex gap-3 pb-4">
            <div className="flex flex-col items-center">
              <span className={`h-3 w-3 rounded-full border-2 shrink-0 ${dot}`} aria-hidden />
              {!isLast && <span className="w-0.5 flex-1 bg-gray-200 mt-1 min-h-[1.5rem]" aria-hidden />}
            </div>
            <div className="flex-1 min-w-0 pt-0">
              <p className={`text-sm font-medium ${item.status === 'current' ? 'text-emerald-800' : 'text-gray-800'}`}>
                {item.title}
              </p>
              {item.subtitle && <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>}
              {item.time && <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── HeroPanel ─────────────────────────────────────────────────────────────────

export function HeroPanel({
  title,
  subtitle,
  badge,
  children,
  actions,
  variant = 'brand',
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  variant?: 'brand' | 'neutral' | 'warning';
}) {
  const bg =
    variant === 'brand'
      ? 'bg-gradient-to-br from-fizza-primary via-emerald-700 to-fizza-secondary text-white'
      : variant === 'warning'
      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
      : 'bg-white border border-gray-100 text-gray-900 shadow-card';

  return (
    <div className={`rounded-2xl p-6 sm:p-8 ${bg}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          {badge && <div className="mb-2">{badge}</div>}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && (
            <p className={`mt-1 text-sm leading-relaxed ${variant === 'neutral' ? 'text-gray-500' : 'text-white/85'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

// ─── AttentionList ─────────────────────────────────────────────────────────────

export function AttentionList({
  items,
}: {
  items: { id: string; title: string; description: string; href: string; tone?: 'warning' | 'danger' | 'info' }[];
}) {
  if (items.length === 0) return null;
  const toneClass = {
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <EnterpriseCard header={<SectionHeader title="Needs your attention" className="mb-0" />} padding="none">
      <ul className="divide-y divide-gray-50">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              className="flex items-center gap-3 px-5 sm:px-6 py-4 hover:bg-emerald-50/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <span className={`badge text-[10px] ${toneClass[item.tone ?? 'warning']}`}>Action</span>
            </a>
          </li>
        ))}
      </ul>
    </EnterpriseCard>
  );
}

// ─── SkeletonBlock ───────────────────────────────────────────────────────────────

export function SkeletonBlock({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <EnterpriseCard padding="default">
      <SkeletonBlock className="h-5 w-1/3 mb-4" />
      <SkeletonBlock className="h-4 w-full mb-2" />
      <SkeletonBlock className="h-4 w-2/3" />
    </EnterpriseCard>
  );
}
