'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

// ─── Page header ───────────────────────────────────────────────────────────────

export function ParentPageHeader({
  title,
  subtitle,
  action,
  meta,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 leading-relaxed">{subtitle}</p>}
        {meta && <div className="mt-2 flex flex-wrap gap-2">{meta}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Hero card ─────────────────────────────────────────────────────────────────

export function ParentHeroCard({
  title,
  subtitle,
  badge,
  details,
  actions,
  variant = 'brand',
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
  variant?: 'brand' | 'neutral';
}) {
  const isBrand = variant === 'brand';
  return (
    <div
      className={[
        'rounded-2xl p-5 sm:p-7 overflow-hidden',
        isBrand
          ? 'bg-gradient-to-br from-fizza-primary via-emerald-700 to-fizza-secondary text-white shadow-lg shadow-emerald-900/10'
          : 'bg-white border border-gray-100 text-gray-900 shadow-card',
      ].join(' ')}
    >
      {badge && <div className="mb-2">{badge}</div>}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
      {subtitle && (
        <p className={`mt-1.5 text-sm leading-relaxed ${isBrand ? 'text-white/90' : 'text-gray-500'}`}>{subtitle}</p>
      )}
      {details && <div className={`mt-4 space-y-2 text-sm ${isBrand ? 'text-white/95' : 'text-gray-700'}`}>{details}</div>}
      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ─── KPI grid ──────────────────────────────────────────────────────────────────

export function ParentKpiCard({
  label,
  value,
  helper,
  icon: Icon,
  color = '#0B683A',
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: LucideIcon;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1 text-lg font-bold text-gray-900 truncate">{value}</p>
          {helper && <p className="text-xs text-gray-500 mt-0.5">{helper}</p>}
        </div>
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14`, color }}>
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

export function ParentKpiGrid({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns];
  return <div className={`grid gap-3 ${cols}`}>{children}</div>;
}

// ─── Attention list ────────────────────────────────────────────────────────────

export type ParentAttentionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone?: 'warning' | 'info' | 'danger';
};

export function ParentAttentionList({ items }: { items: ParentAttentionItem[] }) {
  if (!items.length) return null;
  const toneClass = {
    warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
    info: 'border-blue-200 bg-blue-50/80 text-blue-900',
    danger: 'border-red-200 bg-red-50/80 text-red-900',
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Needs attention</h3>
      </div>
      <ul className="divide-y divide-gray-50">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href as '/dashboard'}
              className={`flex flex-col gap-0.5 px-5 py-3.5 hover:bg-gray-50/80 transition-colors border-l-4 ${toneClass[item.tone ?? 'info']}`}
            >
              <span className="text-sm font-semibold">{item.title}</span>
              <span className="text-xs opacity-80">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Rider card ────────────────────────────────────────────────────────────────

export function ParentRiderCard({
  name,
  relationship,
  school,
  grade,
  phone,
  avatarUrl,
  specialNeeds,
  emergencyComplete,
  activeSubscriptions,
  upcomingTrips,
  actions,
}: {
  name: string;
  relationship?: string | null;
  school?: string | null;
  grade?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  specialNeeds?: boolean;
  emergencyComplete?: boolean;
  activeSubscriptions?: number;
  upcomingTrips?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-card">
      <div className="flex items-start gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-bold text-fizza-primary shrink-0">
            {name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">{name}</h3>
            {specialNeeds && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                Special needs
              </span>
            )}
          </div>
          {relationship && <p className="text-xs text-gray-500 mt-0.5 capitalize">{relationship}</p>}
          {(school || grade) && (
            <p className="text-xs text-gray-600 mt-1">{[school, grade ? `Grade ${grade}` : null].filter(Boolean).join(' · ')}</p>
          )}
          {phone && <p className="text-xs text-gray-500 mt-0.5">{phone}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600">
              {activeSubscriptions ?? 0} active plan{(activeSubscriptions ?? 0) === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600">
              {upcomingTrips ?? 0} upcoming trip{(upcomingTrips ?? 0) === 1 ? '' : 's'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-lg ${emergencyComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              Emergency contact {emergencyComplete ? 'on file' : 'incomplete'}
            </span>
          </div>
        </div>
        {actions && <div className="shrink-0 flex flex-col gap-1">{actions}</div>}
      </div>
    </div>
  );
}

// ─── Subscription card ─────────────────────────────────────────────────────────

export function ParentSubscriptionCard({
  planName,
  statusBadge,
  paymentBadge,
  riders,
  route,
  schedule,
  serviceDays,
  driver,
  vehicle,
  price,
  addOns,
  nextTrip,
  actions,
}: {
  planName: string;
  statusBadge: ReactNode;
  paymentBadge?: ReactNode;
  riders: string;
  route: string;
  schedule: string;
  serviceDays: string;
  driver?: ReactNode;
  vehicle?: string;
  price: string;
  addOns?: string;
  nextTrip?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900">{planName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{riders}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">{statusBadge}{paymentBadge}</div>
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-3 text-sm">
        <ParentInfoRow label="Route" value={route} />
        <ParentInfoRow label="Schedule" value={schedule} />
        <ParentInfoRow label="Service days" value={serviceDays} />
        {driver && <ParentInfoRow label="Driver" value={driver} />}
        {vehicle && <ParentInfoRow label="Vehicle" value={vehicle} />}
        {addOns && <ParentInfoRow label="Add-ons" value={addOns} />}
        {nextTrip && <ParentInfoRow label="Next trip" value={nextTrip} />}
        <p className="text-base font-bold text-fizza-primary pt-1">{price}</p>
      </div>
      {actions && <div className="px-4 sm:px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function ParentInfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide sm:w-24 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}

// ─── Trip card ─────────────────────────────────────────────────────────────────

export function ParentTripCard({
  dateTime,
  riderName,
  riderMeta,
  specialNeeds,
  pickup,
  dropoff,
  legType,
  statusBadge,
  driverBlock,
  vehicle,
  trackingLabel,
  actions,
}: {
  dateTime: string;
  riderName: string;
  riderMeta?: string;
  specialNeeds?: boolean;
  pickup: string;
  dropoff: string;
  legType?: string;
  statusBadge: ReactNode;
  driverBlock: ReactNode;
  vehicle: string;
  trackingLabel: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{dateTime}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-gray-700">{riderName}</span>
              {riderMeta && <span className="text-xs text-gray-400">{riderMeta}</span>}
              {specialNeeds && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Special needs</span>
              )}
            </div>
          </div>
          {statusBadge}
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {legType && <p className="text-xs font-medium text-gray-500 uppercase">{legType.replace('_', ' ')}</p>}
          <p><span className="text-gray-400">Pickup:</span> {pickup}</p>
          <p><span className="text-gray-400">Drop-off:</span> {dropoff}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
          {driverBlock}
          <p className="text-xs text-gray-600"><span className="text-gray-400">Vehicle:</span> {vehicle}</p>
          <p className="text-xs font-medium text-emerald-700">{trackingLabel}</p>
        </div>
      </div>
      {actions && <div className="px-4 sm:px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ParentDriverBlock({
  name,
  rating,
  avatarUrl,
}: {
  name: string;
  rating?: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-fizza-primary">
          {name.charAt(0)}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-gray-900">{name}</p>
        {rating && rating !== '—' && <p className="text-xs text-gray-500">Rating {rating}</p>}
      </div>
    </div>
  );
}

// ─── Wallet ────────────────────────────────────────────────────────────────────

export function ParentWalletHero({
  balance,
  pendingLabel,
  lastUpdated,
  onTopUp,
  topUpLoading,
}: {
  balance: string;
  pendingLabel?: string;
  lastUpdated?: string;
  onTopUp?: () => void;
  topUpLoading?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-fizza-primary to-emerald-800 text-white p-6 shadow-lg">
      <p className="text-sm text-white/80">Available balance</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{balance}</p>
      {pendingLabel && <p className="text-xs text-amber-200 mt-2">{pendingLabel}</p>}
      {lastUpdated && <p className="text-[11px] text-white/60 mt-1">Updated {lastUpdated}</p>}
      {onTopUp && (
        <Button variant="secondary" size="sm" className="mt-4" loading={topUpLoading} onClick={onTopUp}>
          Quick top-up
        </Button>
      )}
    </div>
  );
}

export function ParentWalletTxRow({
  label,
  amount,
  amountColor,
  statusBadge,
  time,
  onClick,
}: {
  label: string;
  amount: string;
  amountColor: string;
  statusBadge?: ReactNode;
  time: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{time}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${amountColor}`}>{amount}</p>
        {statusBadge}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors">
        {inner}
      </button>
    );
  }
  return <div className="flex items-center gap-3 px-4 py-3">{inner}</div>;
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

export function ParentFilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            'shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
            active === tab.id ? 'bg-fizza-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ].join(' ')}
        >
          {tab.label}{tab.count != null ? ` (${tab.count})` : ''}
        </button>
      ))}
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────────

export function ParentDrawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right sm:rounded-l-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close drawer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

// ─── States ────────────────────────────────────────────────────────────────────

export function ParentEmptyState({
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
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
      {Icon && <Icon className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden />}
      <p className="font-semibold text-gray-800">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ParentLoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="h-8 w-8 rounded-full border-2 border-emerald-200 border-t-fizza-primary animate-spin mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ParentErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-800">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}

export function ParentSectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ParentQuickActionGrid({ items }: { items: { href: string; icon: LucideIcon; title: string; sub: string; bg: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href as '/dashboard'}
          className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3 hover:border-emerald-200 hover:shadow-sm transition-all min-h-[88px]"
        >
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.bg}`}>
            <item.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-gray-800">{item.title}</p>
            <p className="text-[10px] text-gray-500 truncate">{item.sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
