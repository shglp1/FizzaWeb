/** Format subscription route/schedule summaries for admin list UI. */

import { resolveEffectiveServiceDates } from '../admin/subscriptionTimeline.ts';

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

type ScheduleRow = { weekday: number; isOffDay: boolean };

type SubscriptionSummaryInput = {
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  normalizedPickupLabel?: string | null;
  normalizedDropoffLabel?: string | null;
  tripDirection?: string | null;
  pickupTime?: string | null;
  returnTime?: string | null;
  startsOn?: string | Date | null;
  endsOn?: string | Date | null;
  createdAt?: string | Date | null;
  actualServiceDays?: number | null;
  schedules?: ScheduleRow[];
  package?: { billingCycle?: string | null } | null;
};

export function formatRouteSummary(sub: SubscriptionSummaryInput): string {
  const pickup = sub.normalizedPickupLabel ?? sub.pickupLocation ?? '—';
  const dropoff = sub.normalizedDropoffLabel ?? sub.dropoffLocation ?? '—';
  return `${pickup} → ${dropoff}`;
}

export function formatScheduleSummary(sub: SubscriptionSummaryInput): string {
  const parts: string[] = [];
  if (sub.pickupTime) parts.push(`Pickup ${sub.pickupTime}`);
  if (sub.returnTime && sub.tripDirection === 'ROUND_TRIP') parts.push(`Return ${sub.returnTime}`);
  if (sub.tripDirection) parts.push(sub.tripDirection === 'ROUND_TRIP' ? 'Round trip' : 'One way');
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function formatServiceDaysSummary(sub: SubscriptionSummaryInput): string {
  const activeDays = (sub.schedules ?? [])
    .filter((s) => !s.isOffDay)
    .map((s) => WEEKDAY_LABELS[s.weekday] ?? String(s.weekday))
    .join(', ');
  const daysPart = activeDays ? activeDays : '—';
  if (sub.actualServiceDays != null) {
    return `${daysPart} (${sub.actualServiceDays} service days)`;
  }
  return daysPart;
}

export function formatServicePeriod(sub: SubscriptionSummaryInput): string {
  const { startsOn, endsOn } = resolveEffectiveServiceDates(sub);
  const start = startsOn ? startsOn.toLocaleDateString('en-SA') : null;
  const end = endsOn ? endsOn.toLocaleDateString('en-SA') : null;
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return '—';
}

export function formatDaysLeft(daysLeft: number | null | undefined, endsOn?: string | Date | null, sub?: SubscriptionSummaryInput): string {
  if (daysLeft != null) {
    if (daysLeft === 0) return 'Ends today';
    if (daysLeft === 1) return '1 day left';
    return `${daysLeft} days left`;
  }
  const effectiveEnd = endsOn ?? (sub ? resolveEffectiveServiceDates(sub).endsOn : null);
  if (effectiveEnd) {
    const end = new Date(effectiveEnd);
    const diff = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
    if (diff <= 0) return 'Ended';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  }
  return '—';
}

export function formatEffectiveDateLabel(sub: SubscriptionSummaryInput, field: 'startsOn' | 'endsOn'): string {
  const dates = resolveEffectiveServiceDates(sub);
  const value = dates[field];
  return value ? formatDateLabel(value) : '—';
}

export function formatDateLabel(value?: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function pickupLabel(sub: SubscriptionSummaryInput): string {
  return sub.normalizedPickupLabel ?? sub.pickupLocation ?? '—';
}

export function dropoffLabel(sub: SubscriptionSummaryInput): string {
  return sub.normalizedDropoffLabel ?? sub.dropoffLocation ?? '—';
}
