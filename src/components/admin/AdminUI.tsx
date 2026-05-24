'use client';

import { ChevronDown, ChevronRight, Search, X, type LucideIcon } from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Badge, Button, Input, LoadingState } from '@/components/ui';
import type { AuditSeverity } from '@/lib/ui/adminAudit';

// ─── AdminSectionHeader ────────────────────────────────────────────────────────

export function AdminSectionHeader({
  title,
  subtitle,
  count,
  countLabel = 'total',
  primaryAction,
  secondaryAction,
  lastUpdated,
}: {
  title: string;
  subtitle?: string;
  count?: number | string;
  countLabel?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  lastUpdated?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
          {count != null && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              {typeof count === 'number' ? count.toLocaleString() : count} {countLabel}
            </span>
          )}
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        {lastUpdated && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            Updated {lastUpdated}
          </p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}

// ─── AdminToolbar ──────────────────────────────────────────────────────────────

export type AdminToolbarFilter = {
  id: string;
  label: string;
  element: ReactNode;
};

export function AdminToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  actions,
  activeChips = [],
  onReset,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: AdminToolbarFilter[];
  actions?: ReactNode;
  activeChips?: { label: string; onRemove: () => void }[];
  onReset?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card space-y-3 mb-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
        {onSearchChange != null && (
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="admin-toolbar-search" className="sr-only">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
              <input
                id="admin-toolbar-search"
                type="search"
                className="input pl-9 pr-9 text-sm h-11 w-full min-h-[44px]"
                placeholder={searchPlaceholder}
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
        {filters.map((f) => (
          <div key={f.id} className="min-w-[140px]">
            <label htmlFor={f.id} className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {f.label}
            </label>
            {f.element}
          </div>
        ))}
        {actions}
        {onReset && activeChips.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="min-h-[44px]">
            Reset filters
          </Button>
        )}
      </div>
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Active</span>
          {activeChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
            >
              {chip.label}
              <button type="button" onClick={chip.onRemove} className="p-0.5 hover:text-emerald-600 min-h-[24px] min-w-[24px]" aria-label={`Remove ${chip.label}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AdminMetricGrid ───────────────────────────────────────────────────────────

export type AdminMetric = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: LucideIcon;
  color?: string;
  onClick?: () => void;
  active?: boolean;
};

export function AdminMetricGrid({ items, columns = 4 }: { items: AdminMetric[]; columns?: 2 | 3 | 4 | 5 | 7 }) {
  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    7: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
  }[columns];

  return (
    <div className={`grid ${colClass} gap-3 mb-5`}>
      {items.map((item) => {
        const Icon = item.icon;
        const Wrapper = item.onClick ? 'button' : 'div';
        return (
          <Wrapper
            key={item.label}
            type={item.onClick ? 'button' : undefined}
            onClick={item.onClick}
            className={[
              'rounded-2xl border bg-white p-4 text-left shadow-card transition-all',
              item.onClick ? 'hover:shadow-card-md cursor-pointer' : '',
              item.active ? 'ring-2 ring-emerald-400 border-emerald-200' : 'border-gray-100',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{item.label}</p>
              {Icon && (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-fizza-secondary shrink-0"
                  style={item.color ? { backgroundColor: `${item.color}18`, color: item.color } : undefined}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
              )}
            </div>
            <p
              className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums truncate"
              style={item.color ? { color: item.color } : undefined}
            >
              {item.value}
            </p>
            {item.helper && <p className="text-xs text-gray-400 mt-1">{item.helper}</p>}
          </Wrapper>
        );
      })}
    </div>
  );
}

// ─── AdminDataCard ─────────────────────────────────────────────────────────────

export function AdminDataCard({
  title,
  subtitle,
  badges,
  metadata,
  children,
  actions,
  compact = false,
  onClick,
  selected,
}: {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  metadata?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'w-full text-left rounded-2xl border bg-white shadow-card transition-all',
        compact ? 'p-4' : 'p-5',
        onClick ? 'hover:shadow-card-md hover:border-emerald-100 cursor-pointer' : '',
        selected ? 'ring-2 ring-emerald-400 border-emerald-200' : 'border-gray-100',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{title}</h3>
            {badges}
          </div>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
      {metadata && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3">{metadata}</div>}
      {children}
    </Wrapper>
  );
}

export function AdminMetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ─── AdminTable ────────────────────────────────────────────────────────────────

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
  mobileLabel?: string;
};

export function AdminTable<T extends { id: string }>({
  columns,
  rows,
  rowActions,
  onRowClick,
  emptyMessage = 'No records found',
  mobileCard,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  mobileCard?: (row: T) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
              <tr className="text-left border-b border-gray-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide ${col.className ?? ''}`}
                  >
                    {col.header}
                  </th>
                ))}
                {rowActions && (
                  <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50/80 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3.5 align-top ${col.className ?? ''}`}>
                      {col.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) =>
          mobileCard ? (
            <div key={row.id}>{mobileCard(row)}</div>
          ) : (
            <AdminDataCard
              key={row.id}
              title={columns[0]?.cell(row) as string}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              compact
            >
              <dl className="space-y-2">
                {columns.slice(1).map((col) => (
                  <div key={col.key} className="flex justify-between gap-2 text-xs">
                    <dt className="text-gray-400 shrink-0">{col.mobileLabel ?? col.header}</dt>
                    <dd className="text-gray-800 text-right font-medium">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
              {rowActions && <div className="mt-3 pt-3 border-t border-gray-50">{rowActions(row)}</div>}
            </AdminDataCard>
          ),
        )}
      </div>
    </>
  );
}

// ─── AdminDrawer ───────────────────────────────────────────────────────────────

export function AdminDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = width === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div
        ref={panelRef}
        className={[
          'relative ml-auto flex h-full w-full flex-col bg-white shadow-2xl',
          'max-md:max-w-none md:rounded-l-2xl',
          `md:${maxW}`,
        ].join(' ')}
        style={{ maxWidth: '100%' }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 shrink-0 safe-area-top">
          <div className="min-w-0">
            <h2 id="admin-drawer-title" className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && (
          <div className="border-t border-gray-100 px-5 py-4 shrink-0 bg-gray-50/80 safe-area-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">{children}</div>
    </section>
  );
}

export function AdminDrawerRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500 sm:w-32 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 flex-1 min-w-0 break-words">{value}</dd>
    </div>
  );
}

// ─── AdminStatusBadge ──────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'gray' | 'purple' | 'orange'> = {
  ACTIVE: 'success',
  PAID: 'success',
  APPROVED: 'success',
  COMPLETED: 'success',
  RESOLVED: 'info',
  PENDING: 'warning',
  PAUSED: 'info',
  SCHEDULED: 'warning',
  DRIVER_ASSIGNED: 'info',
  ON_THE_WAY: 'purple',
  PICKED_UP: 'orange',
  FAILED: 'danger',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'gray',
  REFUNDED: 'gray',
  NEEDS_CHANGES: 'orange',
  INACTIVE: 'gray',
  SUSPENDED: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
  FAMILY_PARENT: 'Parent',
  DRIVER_APPLICANT: 'Driver Applicant',
  APPROVED_DRIVER: 'Approved Driver',
  ADMIN: 'Admin',
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  NEEDS_CHANGES: 'Needs Changes',
  RESOLVED: 'Resolved',
  SCHEDULED: 'Scheduled',
  DRIVER_ASSIGNED: 'Driver Assigned',
  ON_THE_WAY: 'On the Way',
  PICKED_UP: 'Picked Up',
  COMPLETED: 'Completed',
  SUSPENDED: 'Suspended',
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
};

export function AdminStatusBadge({
  status,
  label,
  size = 'sm',
}: {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const display = label ?? STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const variant = STATUS_VARIANTS[status] ?? 'gray';
  return (
    <Badge variant={variant} className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>
      {display}
    </Badge>
  );
}

export function AdminAuditSeverityBadge({ severity }: { severity: AuditSeverity }) {
  const map: Record<AuditSeverity, { variant: 'info' | 'success' | 'warning' | 'danger' | 'purple'; label: string }> = {
    info: { variant: 'info', label: 'Info' },
    success: { variant: 'success', label: 'Success' },
    warning: { variant: 'warning', label: 'Warning' },
    danger: { variant: 'danger', label: 'Critical' },
    admin: { variant: 'purple', label: 'Admin' },
  };
  const { variant, label } = map[severity];
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

// ─── AdminEmptyState ───────────────────────────────────────────────────────────

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-card">
      {Icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <Icon className="h-7 w-7 text-gray-400" strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <p className="font-semibold text-gray-800 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  );
}

// ─── AdminJsonDetails ──────────────────────────────────────────────────────────

export function AdminJsonDetails({ data, label = 'Technical details' }: { data: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-semibold text-gray-600 hover:bg-gray-100 min-h-[44px]"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        {label}
      </button>
      {open && (
        <pre className="px-4 pb-4 text-[11px] text-gray-600 font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
          {text}
        </pre>
      )}
    </div>
  );
}

// ─── AdminTabs ─────────────────────────────────────────────────────────────────

export function AdminTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { label: string; value: string; count?: number }[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <div className="hidden sm:flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors min-h-[44px]',
              active === tab.value
                ? 'border-fizza-secondary text-fizza-secondary'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>
      <div className="sm:hidden mb-4">
        <label htmlFor="admin-tabs-mobile" className="sr-only">Section tab</label>
        <select
          id="admin-tabs-mobile"
          value={active}
          onChange={(e) => onChange(e.target.value)}
          className="input w-full text-sm min-h-[44px]"
        >
          {tabs.map((tab) => (
            <option key={tab.value} value={tab.value}>
              {tab.label}{tab.count != null ? ` (${tab.count})` : ''}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

// ─── AdminFilterSelect ─────────────────────────────────────────────────────────

export function AdminFilterSelect({
  id,
  value,
  onChange,
  options,
  className = '',
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`input text-sm h-11 w-full min-h-[44px] ${className}`}
    >
      {options.map((o) => (
        <option key={o.value || '__all'} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── AdminStickySaveBar ────────────────────────────────────────────────────────

export function AdminStickySaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  message,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  message?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-200 bg-amber-50/95 backdrop-blur-sm px-4 py-3 safe-area-bottom md:pl-72">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-amber-800 font-medium">{message ?? 'You have unsaved changes'}</p>
        <div className="flex gap-2 w-full sm:w-auto">
          {onDiscard && (
            <Button variant="ghost" size="sm" onClick={onDiscard} className="flex-1 sm:flex-none min-h-[44px]">
              Discard
            </Button>
          )}
          <Button variant="primary" size="sm" loading={saving} onClick={onSave} className="flex-1 sm:flex-none min-h-[44px]">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── AdminLoadingGrid ──────────────────────────────────────────────────────────

export function AdminLoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-7 w-12 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export function AdminSectionLoading({ message = 'Loading…' }: { message?: string }) {
  return <LoadingState message={message} />;
}

// ─── Row action menu ───────────────────────────────────────────────────────────

export function AdminRowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function AdminAvatar({ name, colorClass = 'bg-emerald-500' }: { name: string; colorClass?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (name.slice(0, 2) || '??').toUpperCase();
  return (
    <div className={`h-9 w-9 rounded-full ${colorClass} flex items-center justify-center text-white text-xs font-bold shrink-0`} aria-hidden>
      {initials}
    </div>
  );
}
