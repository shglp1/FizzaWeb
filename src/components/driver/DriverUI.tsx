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
} from 'lucide-react';
import { Badge, Button, Card, StatusBadge, type BadgeVariant } from '@/components/ui';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { TRIP_STATUS_LABEL } from '@/lib/trips/tripLifecycle';

// ─── Shared status styling ────────────────────────────────────────────────────

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

// ─── Page header ──────────────────────────────────────────────────────────────

export function DriverPageHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

export function DriverHeroCard({
  nextTripLabel,
  nextAction,
  gpsStatus,
  warnings,
}: {
  nextTripLabel: string;
  nextAction: string;
  gpsStatus: 'active' | 'idle' | 'unavailable';
  warnings?: string[];
}) {
  const gpsCopy = {
    active: { label: 'GPS sharing active', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    idle: { label: 'GPS not started', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    unavailable: { label: 'GPS unavailable', cls: 'text-gray-600 bg-gray-50 border-gray-200' },
  }[gpsStatus];

  return (
    <Card className="border-2 border-fizza-secondary/30 bg-gradient-to-br from-emerald-50/80 to-white overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-fizza-primary">Today&apos;s Route</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">{nextTripLabel}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Next action: <span className="font-semibold text-gray-800">{nextAction}</span>
          </p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${gpsCopy.cls}`}>
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" aria-hidden />
            {gpsCopy.label}
          </span>
        </div>
      </div>
      {warnings && warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50/80 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
              {w}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Stat grid ────────────────────────────────────────────────────────────────

export function DriverStatGrid({
  stats,
}: {
  stats: { label: string; value: number | string; accent?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-medium text-gray-500">{s.label}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: s.accent ?? '#0B683A' }}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export type DriverAlertVariant = 'gps' | 'soon' | 'late' | 'dispatch' | 'warning';

const ALERT_STYLES: Record<DriverAlertVariant, { icon: LucideIcon; cls: string }> = {
  gps: { icon: MapPin, cls: 'border-blue-200 bg-blue-50 text-blue-900' },
  soon: { icon: Clock, cls: 'border-amber-200 bg-amber-50 text-amber-900' },
  late: { icon: AlertTriangle, cls: 'border-orange-200 bg-orange-50 text-orange-900' },
  dispatch: { icon: Bell, cls: 'border-purple-200 bg-purple-50 text-purple-900' },
  warning: { icon: AlertTriangle, cls: 'border-red-200 bg-red-50 text-red-900' },
};

export function DriverAlert({
  variant,
  title,
  message,
  action,
}: {
  variant: DriverAlertVariant;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const meta = ALERT_STYLES[variant];
  const Icon = meta.icon;
  return (
    <div className={`rounded-2xl border px-4 py-3 ${meta.cls}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm mt-0.5 opacity-90">{message}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────

export function DriverTripCard({
  time,
  dateLabel,
  riderName,
  pickup,
  dropoff,
  legType,
  status,
  primaryAction,
  onPrimaryAction,
  primaryDisabled,
  primaryDisabledReason,
  secondaryActions,
}: {
  time: string;
  dateLabel?: string;
  riderName: string;
  pickup: string;
  dropoff: string;
  legType: 'OUTBOUND' | 'RETURN';
  status: TripStatus;
  primaryAction?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  primaryDisabledReason?: string;
  secondaryActions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="shrink-0 text-center min-w-[3.5rem]">
          <p className="text-lg font-bold text-fizza-primary leading-tight">{time}</p>
          {dateLabel && <p className="text-[10px] text-gray-400 mt-0.5">{dateLabel}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 truncate">{riderName}</p>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <StatusBadge variant={DRIVER_STATUS_VARIANT[status] ?? 'gray'}>
                {TRIP_STATUS_LABEL[status]}
              </StatusBadge>
              <Badge variant={legType === 'RETURN' ? 'purple' : 'info'} className="text-[10px]">
                {legType === 'RETURN' ? 'Return' : 'Outbound'}
              </Badge>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-gray-600 truncate">
            <span className="text-emerald-600 font-medium">{pickup}</span>
            <span className="mx-1 text-gray-300">→</span>
            <span className="text-red-600 font-medium">{dropoff}</span>
          </p>
          {(primaryAction || secondaryActions) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {primaryAction && (
                <span title={primaryDisabled ? primaryDisabledReason : undefined}>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={primaryDisabled}
                    onClick={onPrimaryAction}
                  >
                    {primaryAction}
                  </Button>
                </span>
              )}
              {secondaryActions}
            </div>
          )}
          {primaryDisabled && primaryDisabledReason && (
            <p className="mt-1.5 text-[11px] text-gray-500">{primaryDisabledReason}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action bar ───────────────────────────────────────────────────────────────

export function DriverActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
      {children}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

const TIMELINE_STEPS: { status: TripStatus; label: string }[] = [
  { status: 'SCHEDULED', label: 'Scheduled' },
  { status: 'ON_THE_WAY', label: 'On the way' },
  { status: 'ARRIVED_PICKUP', label: 'Arrived pickup' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'EN_ROUTE_DROPOFF', label: 'En route drop-off' },
  { status: 'COMPLETED', label: 'Completed' },
];

const TIMELINE_ORDER: TripStatus[] = [
  'SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP',
  'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF', 'COMPLETED',
];

function timelineIndex(status: TripStatus): number {
  return TIMELINE_ORDER.indexOf(status);
}

export function DriverTimeline({ currentStatus }: { currentStatus: TripStatus }) {
  const idx = timelineIndex(currentStatus);
  return (
    <ol className="relative space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const stepIdx = timelineIndex(step.status);
        const done = idx > stepIdx;
        const active = idx === stepIdx || (step.status === 'SCHEDULED' && idx <= 2);
        return (
          <li key={step.status} className="flex gap-3 items-start">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ${
                  done ? 'bg-emerald-500 border-emerald-500' : active ? 'bg-fizza-secondary border-fizza-secondary' : 'bg-white border-gray-300'
                }`}
              />
              {i < TIMELINE_STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-3 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
            <p className={`text-sm pb-3 ${active ? 'font-semibold text-fizza-primary' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Empty / loading / error ────────────────────────────────────────────────────

export function DriverEmptyState({
  icon: Icon = Calendar,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
        <Icon className="h-7 w-7 text-gray-400" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-base font-semibold text-gray-800">{title}</p>
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
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ─── Quick action link ────────────────────────────────────────────────────────

export function DriverQuickAction({
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
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors min-w-0"
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${accent}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-400 truncate">{subtitle}</p>
      </div>
    </a>
  );
}

// ─── GPS permission card ──────────────────────────────────────────────────────

export function DriverGpsPermissionCard({
  state,
  onEnable,
}: {
  state: 'unknown' | 'granted' | 'denied' | 'unsupported';
  onEnable?: () => void;
}) {
  if (state === 'granted') {
    return (
      <DriverAlert
        variant="gps"
        title="Location permission granted"
        message="You can start sharing live GPS when a trip is active."
      />
    );
  }
  if (state === 'denied') {
    return (
      <DriverAlert
        variant="warning"
        title="Location permission denied"
        message="Enable location in your browser settings to share live GPS with families."
        action={onEnable ? <Button variant="outline" size="sm" onClick={onEnable}>Try again</Button> : undefined}
      />
    );
  }
  if (state === 'unsupported') {
    return (
      <DriverAlert
        variant="warning"
        title="GPS not supported"
        message="This browser does not support location sharing."
      />
    );
  }
  return (
    <DriverAlert
      variant="gps"
      title="Enable GPS sharing"
      message="Share your live location during active trips so families can follow the ride safely."
      action={
        onEnable ? (
          <Button variant="primary" size="sm" onClick={onEnable}>
            <Navigation className="h-4 w-4 mr-1" aria-hidden />
            Check permission
          </Button>
        ) : undefined
      }
    />
  );
}

// ─── Map fallback ─────────────────────────────────────────────────────────────

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
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-8 text-center">
      <MapPin className="mx-auto h-10 w-10 text-gray-400 mb-3" aria-hidden />
      <p className="text-sm font-semibold text-gray-800">
        Map unavailable because this trip does not have confirmed coordinates.
      </p>
      <div className="mt-4 space-y-1 text-sm text-gray-600">
        <p><span className="font-medium text-emerald-700">Pickup:</span> {pickup}</p>
        <p><span className="font-medium text-red-600">Drop-off:</span> {dropoff}</p>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-emerald-700 hover:underline"
      >
        Open in Google Maps
      </a>
    </div>
  );
}

export function DriverSafetyKpiRow({
  submitted,
  underReview,
  resolved,
  rejected,
}: {
  submitted: number;
  underReview: number;
  resolved: number;
  rejected: number;
}) {
  return (
    <DriverStatGrid
      stats={[
        { label: 'Submitted', value: submitted, accent: '#374151' },
        { label: 'Under review', value: underReview, accent: '#D97706' },
        { label: 'Resolved', value: resolved, accent: '#059669' },
        { label: 'Rejected', value: rejected, accent: '#DC2626' },
      ]}
    />
  );
}

export function DriverNotificationGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">{title}</p>
      <div className="space-y-2">{children}</div>
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

export { Shield, Bell, MapPin, Navigation };
