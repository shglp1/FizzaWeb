'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { Badge, Button, StatusBadge, type BadgeVariant } from '@/components/ui';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { TRIP_STATUS_LABEL } from '@/lib/trips/tripLifecycle';
import { truncateRouteLabel, GPS_DENIED_INSTRUCTIONS, GPS_PERMISSION_EXPLAIN } from '@/lib/ui/driverPortal';

// ─── Shared tokens ────────────────────────────────────────────────────────────

export const DRIVER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  SCHEDULED: 'warning',
  DRIVER_ASSIGNED: 'info',
  PRE_TRIP: 'purple',
  ON_THE_WAY: 'purple',
  ARRIVED_PICKUP: 'orange',
  PICKED_UP: 'orange',
  EN_ROUTE_DROPOFF: 'purple',
  ARRIVED_DROPOFF: 'orange',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

const CARD_SHELL = 'rounded-2xl border border-gray-200/80 bg-white shadow-sm';

// ─── 1. Command header ────────────────────────────────────────────────────────

export function DriverCommandHeader({
  title,
  subtitle,
  dateLabel,
  driverStatus = 'On duty',
  gpsIndicator = 'idle',
  action,
}: {
  title: string;
  subtitle?: string;
  dateLabel?: string;
  driverStatus?: string;
  gpsIndicator?: 'active' | 'idle' | 'off';
  action?: ReactNode;
}) {
  const gpsCls = {
    active: 'bg-emerald-500',
    idle: 'bg-amber-400',
    off: 'bg-gray-300',
  }[gpsIndicator];

  return (
    <div className="mb-4 sm:mb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <span className={`h-1.5 w-1.5 rounded-full ${gpsCls}`} />
              {driverStatus}
            </span>
            {dateLabel && (
              <span className="text-[11px] font-medium text-gray-500">{dateLabel}</span>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600 leading-snug">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
      </div>
    </div>
  );
}

/** @deprecated Use DriverCommandHeader */
export const DriverPageHeader = DriverCommandHeader;

// ─── 2. Action hero ─────────────────────────────────────────────────────────

export function DriverActionHero({
  eyebrow = "Today's Route",
  riderName,
  pickup,
  dropoff,
  time,
  countdown,
  statusLabel,
  primaryAction,
  onPrimaryAction,
  primaryDisabled,
  secondaryActions,
  gpsStatus = 'idle',
}: {
  eyebrow?: string;
  riderName: string;
  pickup: string;
  dropoff: string;
  time: string;
  countdown?: string | null;
  statusLabel: string;
  primaryAction?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  secondaryActions?: ReactNode;
  gpsStatus?: 'active' | 'idle' | 'unavailable';
}) {
  const gpsCopy = {
    active: { label: 'GPS live', cls: 'text-emerald-700 bg-emerald-100' },
    idle: { label: 'GPS ready', cls: 'text-amber-800 bg-amber-100' },
    unavailable: { label: 'GPS off', cls: 'text-gray-600 bg-gray-100' },
  }[gpsStatus];

  return (
    <div className={`${CARD_SHELL} overflow-hidden border-emerald-200/60`}>
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 px-4 py-4 sm:px-5 sm:py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-100/90">{eyebrow}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums leading-none">{time}</p>
            {countdown && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-emerald-100">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {countdown === 'Now' ? 'Starts now' : `Starts in ${countdown}`}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${gpsCopy.cls}`}>
            {gpsCopy.label}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-lg font-semibold truncate">{riderName}</p>
          <div className="flex items-start gap-2 text-sm text-emerald-50/95">
            <RouteRail compact pickup={pickup} dropoff={dropoff} />
          </div>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-5 bg-white border-t border-emerald-100/80">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <StatusBadge variant="purple" className="text-xs">{statusLabel}</StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryAction && (
            <Button variant="primary" size="sm" disabled={primaryDisabled} onClick={onPrimaryAction} className="min-h-10 px-4">
              {primaryAction}
            </Button>
          )}
          {secondaryActions}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use DriverActionHero */
export function DriverHeroCard(props: {
  nextTripLabel: string;
  nextAction: string;
  gpsStatus: 'active' | 'idle' | 'unavailable';
  warnings?: string[];
}) {
  return (
    <div className={`${CARD_SHELL} p-4 border-emerald-200/60`}>
      <p className="text-xs font-bold uppercase tracking-wider text-fizza-primary">Today&apos;s Route</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900">{props.nextTripLabel}</h2>
      <p className="mt-1 text-sm text-gray-700">Next: <span className="font-semibold">{props.nextAction}</span></p>
      {props.warnings?.map((w) => (
        <DriverNotice key={w} variant="soon" title="Attention" message={w} compact />
      ))}
    </div>
  );
}

// ─── 3. KPI card ──────────────────────────────────────────────────────────────

export function DriverKpiCard({
  icon: Icon,
  value,
  label,
  helper,
  accent = '#0B683A',
}: {
  icon?: LucideIcon;
  value: number | string;
  label: string;
  helper?: string;
  accent?: string;
}) {
  return (
    <div className={`${CARD_SHELL} px-3 py-3 sm:px-4 sm:py-3.5 flex items-start gap-2.5 min-w-0`}>
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none" style={{ color: accent }}>{value}</p>
        <p className="mt-1 text-[11px] sm:text-xs font-semibold text-gray-700 truncate">{label}</p>
        {helper && <p className="text-[10px] text-gray-400 truncate mt-0.5">{helper}</p>}
      </div>
    </div>
  );
}

export function DriverStatGrid({
  stats,
}: {
  stats: { label: string; value: number | string; accent?: string; icon?: LucideIcon; helper?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
      {stats.map((s) => (
        <DriverKpiCard key={s.label} icon={s.icon} value={s.value} label={s.label} helper={s.helper} accent={s.accent} />
      ))}
    </div>
  );
}

// ─── Route rail (shared) ──────────────────────────────────────────────────────

function RouteRail({
  pickup,
  dropoff,
  compact = false,
}: {
  pickup: string;
  dropoff: string;
  compact?: boolean;
}) {
  const pickupShort = truncateRouteLabel(pickup, compact ? 36 : 48);
  const dropoffShort = truncateRouteLabel(dropoff, compact ? 36 : 48);
  return (
    <div className="flex gap-2.5 min-w-0 flex-1">
      <div className="flex flex-col items-center pt-1 shrink-0">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white/30" />
        <span className="w-0.5 flex-1 min-h-[1.25rem] bg-white/30 my-0.5" />
        <span className="h-2.5 w-2.5 rounded-full bg-red-400 ring-2 ring-white/30" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className={`truncate font-medium ${compact ? 'text-sm' : 'text-sm'}`} title={pickup}>{pickupShort}</p>
        <p className={`truncate font-medium ${compact ? 'text-sm' : 'text-sm'}`} title={dropoff}>{dropoffShort}</p>
      </div>
    </div>
  );
}

// ─── 4. Route card ────────────────────────────────────────────────────────────

export function DriverRouteCard({
  time,
  dateLabel,
  riderName,
  riderMeta,
  pickup,
  dropoff,
  legType,
  status,
  attention,
  primaryAction,
  onPrimaryAction,
  primaryDisabled,
  primaryDisabledReason,
  secondaryActions,
  highlighted = false,
}: {
  time: string;
  dateLabel?: string;
  riderName: string;
  riderMeta?: string;
  pickup: string;
  dropoff: string;
  legType: 'OUTBOUND' | 'RETURN';
  status: TripStatus;
  attention?: 'late' | 'cancelled' | 'dispatch';
  primaryAction?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  primaryDisabledReason?: string;
  secondaryActions?: ReactNode;
  highlighted?: boolean;
}) {
  const shell = highlighted
    ? `${CARD_SHELL} border-emerald-300/70 ring-1 ring-emerald-100 bg-emerald-50/20`
    : attention === 'cancelled'
    ? `${CARD_SHELL} border-red-100 bg-red-50/20 opacity-90`
    : CARD_SHELL;

  return (
    <article className={`${shell} p-3.5 sm:p-4 max-w-full`}>
      <div className="flex gap-3 sm:gap-4">
        <div className="shrink-0 w-14 sm:w-16 text-center border-r border-gray-100 pr-3">
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-fizza-primary leading-none">{time}</p>
          {dateLabel && <p className="text-[10px] font-medium text-gray-400 mt-1">{dateLabel}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{riderName}</p>
              {riderMeta && <p className="text-[11px] text-gray-500 truncate">{riderMeta}</p>}
            </div>
            <div className="flex flex-wrap gap-1 shrink-0">
              <StatusBadge variant={DRIVER_STATUS_VARIANT[status] ?? 'gray'} className="text-[11px]">
                {TRIP_STATUS_LABEL[status]}
              </StatusBadge>
              <Badge variant={legType === 'RETURN' ? 'purple' : 'info'} className="text-[10px]">
                {legType === 'RETURN' ? 'Return' : 'Outbound'}
              </Badge>
              {attention === 'late' && <Badge variant="warning" className="text-[10px]">Late</Badge>}
            </div>
          </div>
          <RouteRail pickup={pickup} dropoff={dropoff} />
          {(primaryAction || secondaryActions) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {primaryAction && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={primaryDisabled}
                  onClick={onPrimaryAction}
                  className="min-h-9 font-semibold"
                >
                  {primaryAction}
                </Button>
              )}
              {secondaryActions}
            </div>
          )}
          {primaryDisabled && primaryDisabledReason && (
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">{primaryDisabledReason}</p>
          )}
        </div>
      </div>
    </article>
  );
}

/** @deprecated Use DriverRouteCard */
export const DriverTripCard = DriverRouteCard;

// ─── 5. Route timeline ────────────────────────────────────────────────────────

const ROUTE_TIMELINE = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'enroute', label: 'On the way' },
  { key: 'pickup', label: 'At pickup' },
  { key: 'boarded', label: 'Picked up' },
  { key: 'dropoff', label: 'Drop-off' },
  { key: 'done', label: 'Complete' },
] as const;

const STATUS_PHASE: Record<string, number> = {
  SCHEDULED: 0, DRIVER_ASSIGNED: 0, PRE_TRIP: 1, ON_THE_WAY: 1,
  ARRIVED_PICKUP: 2, PICKED_UP: 3, EN_ROUTE_DROPOFF: 4, ARRIVED_DROPOFF: 4,
  COMPLETED: 5, CANCELLED: -1, NO_SHOW: -1,
};

export function DriverRouteTimeline({ currentStatus }: { currentStatus: TripStatus }) {
  const phase = STATUS_PHASE[currentStatus] ?? 0;
  if (phase < 0) return null;
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-1 px-1">
      {ROUTE_TIMELINE.map((step, i) => {
        const done = phase > i;
        const active = phase === i;
        return (
          <div key={step.key} className="flex items-center shrink-0">
            <div className="flex flex-col items-center min-w-[3.5rem]">
              <div className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-emerald-500' : active ? 'bg-fizza-secondary ring-2 ring-emerald-200' : 'bg-gray-200'}`} />
              <p className={`mt-1 text-[9px] font-semibold text-center leading-tight max-w-[3.5rem] ${active ? 'text-fizza-primary' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
                {step.label}
              </p>
            </div>
            {i < ROUTE_TIMELINE.length - 1 && (
              <div className={`h-0.5 w-4 sm:w-6 mb-4 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** @deprecated Use DriverRouteTimeline */
export const DriverTimeline = DriverRouteTimeline;

// ─── 6. Bottom action bar ─────────────────────────────────────────────────────

export function DriverBottomActionBar({
  label,
  children,
  visible = true,
}: {
  label?: string;
  children: ReactNode;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="px-4 pt-2.5 pb-1 max-w-lg mx-auto">
        {label && <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">{label}</p>}
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

// ─── 7. Map panel ─────────────────────────────────────────────────────────────

export function DriverMapPanel({
  map,
  statusOverlay,
  mapsUrl,
  loading = false,
  showLegend = true,
  legend,
}: {
  map: ReactNode;
  statusOverlay?: ReactNode;
  mapsUrl?: string;
  loading?: boolean;
  showLegend?: boolean;
  legend?: ReactNode;
}) {
  return (
    <div className={`${CARD_SHELL} overflow-hidden !p-0`}>
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100/80 backdrop-blur-[1px]">
            <RefreshCw className="h-8 w-8 text-fizza-secondary animate-spin" aria-hidden />
          </div>
        )}
        {statusOverlay && (
          <div className="absolute top-3 left-3 right-3 z-10">{statusOverlay}</div>
        )}
        {map}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <div className="flex flex-wrap items-center gap-2">
          {showLegend && (
            <div className="flex flex-wrap gap-3 text-[10px] font-medium text-gray-600">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Pickup</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Drop-off</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Driver</span>
            </div>
          )}
          {legend}
        </div>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-0.5">
            Navigate <ChevronRight className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

export function DriverMapFallback({
  pickup,
  dropoff,
  mapsUrl,
}: {
  pickup: string;
  dropoff: string;
  mapsUrl: string;
}) {
  return (
    <div className={`${CARD_SHELL} px-4 py-8 text-center bg-gradient-to-b from-gray-50 to-white`}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-100">
        <MapPin className="h-7 w-7 text-gray-400" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-gray-800 max-w-xs mx-auto">
        Map unavailable because this trip does not have confirmed coordinates.
      </p>
      <div className="mt-4 mx-auto max-w-sm text-left space-y-2 text-sm">
        <div className="flex gap-2 items-start">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <p className="text-gray-700 truncate" title={pickup}>{truncateRouteLabel(pickup, 56)}</p>
        </div>
        <div className="flex gap-2 items-start">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
          <p className="text-gray-700 truncate" title={dropoff}>{truncateRouteLabel(dropoff, 56)}</p>
        </div>
      </div>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-5 text-sm font-semibold text-emerald-700 hover:underline">
        Open in Google Maps
      </a>
    </div>
  );
}

// ─── 8. Notice ────────────────────────────────────────────────────────────────

export type DriverNoticeVariant = 'gps' | 'soon' | 'late' | 'dispatch' | 'warning' | 'safety';

const NOTICE_STYLES: Record<DriverNoticeVariant, { icon: LucideIcon; cls: string }> = {
  gps: { icon: MapPin, cls: 'border-blue-200 bg-blue-50 text-blue-950' },
  soon: { icon: Clock, cls: 'border-amber-200 bg-amber-50 text-amber-950' },
  late: { icon: AlertTriangle, cls: 'border-orange-200 bg-orange-50 text-orange-950' },
  dispatch: { icon: Bell, cls: 'border-purple-200 bg-purple-50 text-purple-950' },
  warning: { icon: AlertTriangle, cls: 'border-red-200 bg-red-50 text-red-950' },
  safety: { icon: Shield, cls: 'border-red-200 bg-red-50 text-red-950' },
};

export function DriverNotice({
  variant,
  title,
  message,
  action,
  compact = false,
}: {
  variant: DriverNoticeVariant;
  title: string;
  message: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const meta = NOTICE_STYLES[variant];
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border ${meta.cls} ${compact ? 'px-3 py-2 mt-2' : 'px-4 py-3'}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
          <p className={`${compact ? 'text-xs' : 'text-sm'} mt-0.5 opacity-90`}>{message}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use DriverNotice */
export const DriverAlert = DriverNotice;

// ─── Misc shared ──────────────────────────────────────────────────────────────

export function DriverActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-gray-50/90 p-2.5">
      {children}
    </div>
  );
}

export function DriverSectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {action}
    </div>
  );
}

export function DriverQuickActionCard({
  href,
  Icon,
  title,
  subtitle,
  accent,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <a href={href} className={`${CARD_SHELL} flex items-center gap-3 p-3 hover:border-emerald-200 hover:shadow-md transition-all min-w-0 group`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${accent}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-fizza-primary">{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 group-hover:text-fizza-secondary" aria-hidden />
    </a>
  );
}

/** @deprecated Use DriverQuickActionCard */
export const DriverQuickAction = DriverQuickActionCard;

export function DriverGpsPermissionCard({
  state,
  onEnable,
}: {
  state: 'unknown' | 'granted' | 'denied' | 'unsupported';
  onEnable?: () => void;
}) {
  if (state === 'granted') {
    return <DriverNotice variant="gps" title="Location permission granted" message="Start sharing live GPS when a trip is active." />;
  }
  if (state === 'denied') {
    return (
      <DriverNotice
        variant="warning"
        title="Location permission denied"
        message={GPS_DENIED_INSTRUCTIONS}
        action={onEnable ? <Button variant="outline" size="sm" onClick={onEnable}>Retry</Button> : undefined}
      />
    );
  }
  if (state === 'unsupported') {
    return <DriverNotice variant="warning" title="GPS not supported" message="This browser does not support location sharing." />;
  }
  return (
    <DriverNotice
      variant="gps"
      title="Enable GPS sharing"
      message={GPS_PERMISSION_EXPLAIN}
      action={onEnable ? <Button variant="primary" size="sm" onClick={onEnable}><Navigation className="h-4 w-4 mr-1" aria-hidden />Enable GPS sharing</Button> : undefined}
    />
  );
}

export function DriverSafetyKpiRow(props: { submitted: number; underReview: number; resolved: number; rejected: number }) {
  return (
    <DriverStatGrid
      stats={[
        { label: 'Submitted', value: props.submitted, accent: '#374151' },
        { label: 'Under review', value: props.underReview, accent: '#D97706' },
        { label: 'Resolved', value: props.resolved, accent: '#059669' },
        { label: 'Rejected', value: props.rejected, accent: '#DC2626' },
      ]}
    />
  );
}

export function DriverNotificationCard({
  title,
  message,
  time,
  category,
  unread,
  icon: Icon,
  onMarkRead,
  marking,
}: {
  title: string;
  message: string;
  time: string;
  category: string;
  unread: boolean;
  icon: LucideIcon;
  onMarkRead?: () => void;
  marking?: boolean;
}) {
  return (
    <div className={`${CARD_SHELL} p-3.5 flex gap-3 ${unread ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold truncate ${unread ? 'text-gray-900' : 'text-gray-600'}`}>{title}</p>
          <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{time}</span>
        </div>
        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{message}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <Badge variant="gray" className="text-[10px]">{category}</Badge>
          {unread && onMarkRead && (
            <button type="button" onClick={onMarkRead} disabled={marking} className="text-[11px] font-semibold text-fizza-secondary hover:underline disabled:opacity-50">
              Mark read
            </button>
          )}
        </div>
      </div>
      {unread && <span className="h-2 w-2 rounded-full bg-fizza-secondary shrink-0 mt-1" aria-hidden />}
    </div>
  );
}

export function DriverNotificationGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-0.5">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function DriverEmptyState({ icon: Icon = Calendar, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className={`${CARD_SHELL} flex flex-col items-center px-6 py-12 text-center border-dashed`}>
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
        <Icon className="h-7 w-7 text-emerald-600/60" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-base font-semibold text-gray-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DriverLoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <RefreshCw className="h-8 w-8 text-fizza-secondary animate-spin" aria-hidden />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

export function DriverErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" aria-hidden />
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function DriverSuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      {message}
    </div>
  );
}

export function DriverSafetyHero({ onNewReport }: { onNewReport: () => void }) {
  return (
    <div className={`${CARD_SHELL} p-4 sm:p-5 bg-gradient-to-br from-red-50 to-white border-red-100`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">Safety Center</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">Need help during a trip?</h2>
          <p className="text-sm text-gray-600 mt-1">Report incidents quickly. Our team reviews every report.</p>
        </div>
        <Button variant="primary" size="sm" onClick={onNewReport} className="shrink-0 min-h-10">New safety report</Button>
      </div>
    </div>
  );
}

export function DriverTrackingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-0.5">{title}</p>
      {description ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{description}</p>
      ) : null}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export { Shield, Bell, MapPin, Navigation, Radio };
